/**
 * SSLens - GitHub Copilot Chat Participant
 * Registers the `@sslens` participant so users can inspect certificates,
 * check expiry, and generate pinning code conversationally from Copilot
 * Chat. Uses the chat request's language model for analysis and degrades
 * gracefully to structured markdown when no model is available.
 */

import * as vscode from 'vscode';
import { exportService } from '../services/exportService';
import { getStorageService } from '../services/storageService';
import { CertificateChain, PinningCodeOptions, SUPPORTED_PLATFORMS } from '../types';
import {
  createSslService,
  extractTargets,
  renderCertificateMarkdown,
  summarizeChain,
  Target,
} from './certContext';

const PARTICIPANT_ID = 'sslens.chat';

const PLATFORM_KEYWORDS: Array<{ pattern: RegExp; platform: PinningCodeOptions['platform'] }> = [
  { pattern: /retrofit/i, platform: 'android-retrofit' },
  { pattern: /okhttp|kotlin|android/i, platform: 'android-okhttp' },
  { pattern: /alamofire/i, platform: 'ios-alamofire' },
  { pattern: /urlsession|swift|ios/i, platform: 'ios-swift' },
  { pattern: /dio/i, platform: 'flutter-dio' },
  { pattern: /flutter|dart/i, platform: 'flutter-http' },
  { pattern: /react[\s-]?native|\bexpo\b/i, platform: 'react-native' },
];

interface SSLensChatResult extends vscode.ChatResult {
  metadata?: { command?: string; domain?: string };
}

/**
 * Ask the request's language model a question with certificate context.
 * Returns false when no model is available or the request fails, so the
 * caller can fall back to static markdown.
 */
async function streamModelAnalysis(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  instruction: string,
  certContext: unknown,
  userQuestion: string,
): Promise<boolean> {
  const model = request.model;
  if (!model) {
    return false;
  }

  const messages = [
    vscode.LanguageModelChatMessage.User(
      [
        'You are SSLens, an SSL/TLS certificate expert inside VS Code.',
        instruction,
        'Base every claim strictly on the JSON certificate data provided. Be concise and practical.',
        'When mentioning pinning hashes, always quote them in inline code spans exactly as given.',
        '',
        `Certificate data (fetched live just now):`,
        '```json',
        JSON.stringify(certContext, null, 2),
        '```',
        '',
        `User question: ${userQuestion || '(none — give your standard assessment)'}`,
      ].join('\n'),
    ),
  ];

  try {
    const response = await model.sendRequest(messages, {}, token);
    for await (const chunk of response.text) {
      stream.markdown(chunk);
    }
    return true;
  } catch (error) {
    if (error instanceof vscode.LanguageModelError) {
      console.warn(`SSLens: language model unavailable (${error.code}), falling back to static report`);
      return false;
    }
    throw error;
  }
}

async function fetchChainWithProgress(
  stream: vscode.ChatResponseStream,
  target: Target,
): Promise<CertificateChain> {
  stream.progress(`Fetching certificate from ${target.domain}:${target.port}…`);
  return createSslService().fetchCertificateChain(target.domain, target.port);
}

function addViewerButton(stream: vscode.ChatResponseStream, target: Target): void {
  stream.button({
    command: 'sslens.fetchFromDomain',
    title: vscode.l10n.t('Open in SSLens Viewer'),
    arguments: [target.domain, target.port],
  });
}

function noTargetResponse(stream: vscode.ChatResponseStream, example: string): SSLensChatResult {
  stream.markdown(
    `I couldn't find a hostname in your message. Try something like:\n\n\`\`\`\n${example}\n\`\`\``,
  );
  return {};
}

async function handleCheck(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SSLensChatResult> {
  const targets = extractTargets(request.prompt);
  if (targets.length === 0) {
    return noTargetResponse(stream, '@sslens /check api.example.com');
  }

  const target = targets[0];
  const chain = await fetchChainWithProgress(stream, target);

  stream.markdown(renderCertificateMarkdown(chain) + '\n\n');

  const analyzed = await streamModelAnalysis(
    request,
    stream,
    token,
    'Give a short security assessment of this certificate chain: trust status, expiry risk, key strength, signature algorithm, and anything a mobile developer doing certificate pinning should know. Use a few bullet points.',
    summarizeChain(chain),
    request.prompt,
  );
  if (!analyzed) {
    stream.markdown('\n_Connect a language model (e.g. GitHub Copilot) for an AI security assessment of this chain._');
  }

  addViewerButton(stream, target);
  return { metadata: { command: 'check', domain: target.domain } };
}

async function handlePin(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
): Promise<SSLensChatResult> {
  const targets = extractTargets(request.prompt);
  if (targets.length === 0) {
    return noTargetResponse(stream, '@sslens /pin api.example.com for okhttp');
  }

  const target = targets[0];
  const platform =
    PLATFORM_KEYWORDS.find(entry => entry.pattern.test(request.prompt))?.platform ?? 'android-okhttp';
  const platformName = SUPPORTED_PLATFORMS.find(p => p.id === platform)?.name ?? platform;
  const language = SUPPORTED_PLATFORMS.find(p => p.id === platform)?.language ?? 'text';

  const chain = await fetchChainWithProgress(stream, target);
  const leaf = chain.certificates[0];
  const backupHashes = chain.certificates.slice(1).map(c => c.spkiHash).filter(Boolean);

  stream.markdown(
    [
      `### 📌 Certificate pinning for \`${target.domain}\` — ${platformName}`,
      '',
      `Leaf SPKI pin: \`${leaf.spkiHash}\``,
      backupHashes.length > 0
        ? `Backup pins (intermediates, recommended for rotation): ${backupHashes.map(h => `\`${h}\``).join(', ')}`
        : '',
      '',
      `\`\`\`${language}`,
      exportService.generatePinningCode({
        platform,
        domains: [target.domain],
        hashes: [leaf.spkiHash],
        includeBackup: true,
      }),
      '```',
      '',
      `> ⚠️ Pin the **SPKI hash**, keep at least one backup pin, and plan for certificate rotation. This cert expires in **${leaf.daysUntilExpiry} days** (${new Date(leaf.validTo).toUTCString()}).`,
    ]
      .filter(Boolean)
      .join('\n'),
  );

  addViewerButton(stream, target);
  return { metadata: { command: 'pin', domain: target.domain } };
}

async function handleExpiry(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
): Promise<SSLensChatResult> {
  let targets = extractTargets(request.prompt);

  if (targets.length === 0) {
    const saved = getStorageService().getSavedDomains();
    targets = saved.map(d => ({ domain: d.domain, port: d.port }));
    if (targets.length === 0) {
      stream.markdown(
        'No domains given and no saved domains found. Try `@sslens /expiry example.com github.com`, or save domains in the SSLens sidebar first.',
      );
      return {};
    }
    stream.markdown(`Checking your **${targets.length} saved domain${targets.length === 1 ? '' : 's'}**…\n\n`);
  }

  stream.progress('Checking certificate expiry…');
  const service = createSslService();
  const rows = await Promise.all(
    targets.slice(0, 25).map(async target => {
      try {
        const cert = await service.fetchCertificate(target.domain, target.port);
        const icon = cert.isExpired ? '❌' : cert.daysUntilExpiry <= 30 ? '⚠️' : '✅';
        return `| \`${target.domain}\` | ${icon} ${cert.isExpired ? 'EXPIRED' : `${cert.daysUntilExpiry} days`} | ${new Date(cert.validTo).toUTCString()} | ${cert.issuer.commonName} |`;
      } catch (error) {
        return `| \`${target.domain}\` | ⚠️ Error | — | ${error instanceof Error ? error.message : String(error)} |`;
      }
    }),
  );

  stream.markdown(
    ['| Domain | Expires in | Not after | Issuer |', '| --- | --- | --- | --- |', ...rows].join('\n'),
  );
  return { metadata: { command: 'expiry' } };
}

async function handleCompare(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SSLensChatResult> {
  const targets = extractTargets(request.prompt);
  if (targets.length < 2) {
    return noTargetResponse(stream, '@sslens /compare example.com example.org');
  }

  const [a, b] = targets;
  stream.progress(`Fetching certificates from ${a.domain} and ${b.domain}…`);
  const service = createSslService();
  const [chainA, chainB] = await Promise.all([
    service.fetchCertificateChain(a.domain, a.port),
    service.fetchCertificateChain(b.domain, b.port),
  ]);

  const certA = chainA.certificates[0];
  const certB = chainB.certificates[0];
  const sameKey = certA.spkiHash === certB.spkiHash;

  stream.markdown(
    [
      `### 🔍 \`${a.domain}\` vs \`${b.domain}\``,
      '',
      '| Field | ' + `\`${a.domain}\`` + ' | ' + `\`${b.domain}\`` + ' |',
      '| --- | --- | --- |',
      `| Subject CN | ${certA.subject.commonName} | ${certB.subject.commonName} |`,
      `| Issuer | ${certA.issuer.commonName} | ${certB.issuer.commonName} |`,
      `| Expires | ${new Date(certA.validTo).toUTCString()} | ${new Date(certB.validTo).toUTCString()} |`,
      `| Key | ${certA.publicKey.algorithm} ${certA.publicKey.keySize} | ${certB.publicKey.algorithm} ${certB.publicKey.keySize} |`,
      `| SPKI pin | \`${certA.spkiHash}\` | \`${certB.spkiHash}\` |`,
      '',
      sameKey
        ? '✅ Both hosts present the **same public key** — one pin covers both.'
        : 'ℹ️ Different public keys — each host needs its own pin.',
      '',
    ].join('\n'),
  );

  await streamModelAnalysis(
    request,
    stream,
    token,
    'Compare these two certificate chains and point out meaningful differences (issuer, validity, key strength, shared infrastructure). Two or three bullets max.',
    { first: summarizeChain(chainA), second: summarizeChain(chainB) },
    request.prompt,
  );

  return { metadata: { command: 'compare' } };
}

async function handleGeneral(
  request: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<SSLensChatResult> {
  const targets = extractTargets(request.prompt);

  if (targets.length === 0) {
    // Pure knowledge question — answer with the model, no cert context.
    const answered = await streamModelAnalysis(
      request,
      stream,
      token,
      'Answer the user\'s SSL/TLS or certificate-pinning question. If inspecting a live host would help, tell them to mention the hostname so you can fetch its certificate.',
      { note: 'No live certificate was fetched for this request.' },
      request.prompt,
    );
    if (!answered) {
      stream.markdown(
        [
          'Ask me about SSL/TLS certificates! I can:',
          '',
          '- `/check <domain>` — fetch & analyze a live certificate chain',
          '- `/pin <domain>` — generate certificate pinning code (OkHttp, URLSession, Dio, …)',
          '- `/expiry [domains]` — expiry report for given or saved domains',
          '- `/compare <a> <b>` — compare two hosts\' certificates',
        ].join('\n'),
      );
    }
    return {};
  }

  // Host mentioned — fetch it and let the model answer with real data.
  const target = targets[0];
  const chain = await fetchChainWithProgress(stream, target);

  const answered = await streamModelAnalysis(
    request,
    stream,
    token,
    'Answer the user\'s question about this host using the live certificate data.',
    summarizeChain(chain),
    request.prompt,
  );
  if (!answered) {
    stream.markdown(renderCertificateMarkdown(chain));
  }

  addViewerButton(stream, target);
  return { metadata: { domain: target.domain } };
}

/**
 * Register the @sslens chat participant.
 */
export function registerChatParticipant(context: vscode.ExtensionContext): void {
  const handler: vscode.ChatRequestHandler = async (request, _chatContext, stream, token) => {
    try {
      switch (request.command) {
        case 'check':
          return await handleCheck(request, stream, token);
        case 'pin':
          return await handlePin(request, stream);
        case 'expiry':
          return await handleExpiry(request, stream);
        case 'compare':
          return await handleCompare(request, stream, token);
        default:
          return await handleGeneral(request, stream, token);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stream.markdown(`⚠️ **SSLens couldn't complete that request:** ${message}`);
      return { errorDetails: { message } };
    }
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
  participant.followupProvider = {
    provideFollowups(result: SSLensChatResult) {
      const domain = result.metadata?.domain;
      const followups: vscode.ChatFollowup[] = [];
      if (domain && result.metadata?.command !== 'pin') {
        followups.push({
          prompt: `/pin ${domain}`,
          label: `📌 Generate pinning code for ${domain}`,
        });
      }
      if (domain && result.metadata?.command !== 'check') {
        followups.push({
          prompt: `/check ${domain}`,
          label: `🔐 Full security check for ${domain}`,
        });
      }
      if (result.metadata?.command !== 'expiry') {
        followups.push({ prompt: '/expiry', label: '📅 Check expiry of saved domains' });
      }
      return followups;
    },
  };

  context.subscriptions.push(participant);
}
