/**
 * SSLens Documentation - Main JavaScript
 * Bootstrap 5 + jQuery Enhanced
 */

(function($) {
    'use strict';

    // ==========================================
    // Initialize on Document Ready
    // ==========================================
    $(document).ready(function() {
        initThemeToggle();
        initNavbarScroll();
        initNavigation();
        initScrollReveal();
        initSmoothScroll();
        initScrollSpy();
        initCopyButtons();
        initSearch();
        initTabs();
    });

    // ==========================================
    // Theme Toggle - Dark/Light Mode
    // ==========================================
    function initThemeToggle() {
        const $html = $('html');
        const $themeToggle = $('#themeToggle');
        
        // Get saved theme or detect system preference
        const getSavedTheme = () => {
            const saved = localStorage.getItem('theme');
            if (saved) return saved;
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        };
        
        // Apply theme
        const applyTheme = (theme) => {
            $html.attr('data-bs-theme', theme);
            updateThemeIcon(theme);
            localStorage.setItem('theme', theme);
        };
        
        // Update the toggle icon
        const updateThemeIcon = (theme) => {
            const icon = theme === 'light' ? 'bi-moon-fill' : 'bi-sun-fill';
            $themeToggle.html(`<i class="bi ${icon}"></i>`);
            $themeToggle.attr('title', theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
        };
        
        // Apply initial theme
        applyTheme(getSavedTheme());
        
        // Toggle theme on click
        $themeToggle.on('click', function() {
            const current = $html.attr('data-bs-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            
            // Add animation
            $(this).addClass('animate__animated animate__rotateIn');
            setTimeout(() => {
                $(this).removeClass('animate__animated animate__rotateIn');
            }, 300);
            
            applyTheme(next);
        });
        
        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    // ==========================================
    // Navbar Scroll Effect
    // ==========================================
    function initNavbarScroll() {
        const $navbar = $('.navbar');
        let lastScrollY = 0;
        let ticking = false;
        
        const updateNavbar = () => {
            if (lastScrollY > 50) {
                $navbar.addClass('scrolled');
            } else {
                $navbar.removeClass('scrolled');
            }
            ticking = false;
        };
        
        $(window).on('scroll', function() {
            lastScrollY = window.scrollY;
            
            if (!ticking) {
                window.requestAnimationFrame(updateNavbar);
                ticking = true;
            }
        });
        
        // Initial check
        if (window.scrollY > 50) {
            $navbar.addClass('scrolled');
        }
    }

    // ==========================================
    // Mobile Navigation
    // ==========================================
    function initNavigation() {
        const $navToggle = $('.navbar-toggler');
        const $navCollapse = $('#navbarNav');
        const $body = $('body');
        
        // Close mobile nav on link click
        $navCollapse.find('.nav-link').on('click', function() {
            if ($(window).width() < 992) {
                bootstrap.Collapse.getInstance($navCollapse[0])?.hide();
            }
        });
        
        // Handle body scroll when mobile nav is open
        $navCollapse.on('show.bs.collapse', function() {
            $body.addClass('nav-open');
        });
        
        $navCollapse.on('hide.bs.collapse', function() {
            $body.removeClass('nav-open');
        });
        
        // Close on escape key
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape') {
                bootstrap.Collapse.getInstance($navCollapse[0])?.hide();
            }
        });
        
        // Close on window resize to desktop
        let resizeTimer;
        $(window).on('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if ($(window).width() >= 992) {
                    bootstrap.Collapse.getInstance($navCollapse[0])?.hide();
                }
            }, 150);
        });
    }

    // ==========================================
    // Scroll Reveal Animations
    // ==========================================
    function initScrollReveal() {
        const $revealElements = $('.feature-card, .doc-card, .platform-card, .quickstart-step');
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        $(entry.target).addClass('revealed');
                        observer.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });
            
            $revealElements.each(function() {
                $(this).addClass('reveal-item');
                observer.observe(this);
            });
        } else {
            // Fallback for older browsers
            $revealElements.addClass('revealed');
        }
    }

    // ==========================================
    // Smooth Scroll for Anchor Links
    // ==========================================
    function initSmoothScroll() {
        $('a[href^="#"]').on('click', function(e) {
            const href = $(this).attr('href');
            
            if (href === '#' || href === '') return;
            
            const $target = $(href);
            if ($target.length) {
                e.preventDefault();
                
                const navHeight = $('.navbar').outerHeight() || 72;
                const targetPosition = $target.offset().top - navHeight - 24;
                
                $('html, body').animate({
                    scrollTop: targetPosition
                }, 500, 'swing');
                
                // Update URL without scrolling
                history.pushState(null, null, href);
            }
        });
    }

    // ==========================================
    // Scroll Spy for Sidebar Navigation
    // ==========================================
    function initScrollSpy() {
        const $sidebarLinks = $('.sidebar-nav a');
        const $sections = $('h2[id], h3[id]');
        
        if (!$sidebarLinks.length || !$sections.length) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    
                    $sidebarLinks.removeClass('active');
                    $sidebarLinks.filter(`[href="#${id}"]`).addClass('active');
                }
            });
        }, {
            rootMargin: '-100px 0px -50% 0px',
            threshold: 0
        });
        
        $sections.each(function() {
            observer.observe(this);
        });
    }

    // ==========================================
    // Copy to Clipboard
    // ==========================================
    function initCopyButtons() {
        $(document).on('click', '.copy-btn', async function() {
            const $button = $(this);
            const $codeBlock = $button.closest('.code-block');
            const $code = $codeBlock.find('code');
            
            if ($code.length) {
                try {
                    await navigator.clipboard.writeText($code.text());
                    
                    // Show success feedback
                    const originalHtml = $button.html();
                    $button.html('<i class="bi bi-check"></i> Copied!');
                    $button.addClass('copied');
                    
                    setTimeout(() => {
                        $button.html(originalHtml);
                        $button.removeClass('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                    $button.text('Failed');
                    
                    setTimeout(() => {
                        $button.text('Copy');
                    }, 2000);
                }
            }
        });
    }

    // ==========================================
    // Search Functionality
    // ==========================================
    function initSearch() {
        const $searchInput = $('.search-input');
        const $searchResults = $('.search-results');
        
        if (!$searchInput.length) return;
        
        // Search data
        const searchData = [
            { title: 'Getting Started', url: 'getting-started.html', keywords: 'install setup begin quick start' },
            { title: 'Fetch Certificate', url: 'commands.html#fetch', keywords: 'fetch download get ssl certificate domain' },
            { title: 'Generate Pinning Code', url: 'pinning.html', keywords: 'pinning code android ios flutter react native' },
            { title: 'Export Certificate', url: 'features.html#export', keywords: 'export pem der save download' },
            { title: 'Configuration', url: 'configuration.html', keywords: 'settings options configure preferences' },
            { title: 'Android SSL Pinning', url: 'pinning.html#android', keywords: 'android okhttp retrofit kotlin java' },
            { title: 'iOS SSL Pinning', url: 'pinning.html#ios', keywords: 'ios swift alamofire urlsession apple' },
            { title: 'Flutter SSL Pinning', url: 'pinning.html#flutter', keywords: 'flutter dart dio http' },
            { title: 'React Native SSL Pinning', url: 'pinning.html#react-native', keywords: 'react native javascript' },
            { title: 'Certificate Chain', url: 'features.html#chain', keywords: 'chain validation verify intermediate root' },
            { title: 'Expiry Monitoring', url: 'features.html#expiry', keywords: 'expiry expire warning monitor' },
            { title: 'Bulk Operations', url: 'features.html#bulk', keywords: 'bulk multiple domains batch' },
            { title: 'Troubleshooting', url: 'troubleshooting.html', keywords: 'error fix problem issue help' },
        ];
        
        $searchInput.on('input', function() {
            const query = $(this).val().toLowerCase().trim();
            
            if (query.length < 2) {
                $searchResults.empty().removeClass('active');
                return;
            }
            
            const results = searchData.filter(item => {
                const searchText = `${item.title} ${item.keywords}`.toLowerCase();
                return searchText.includes(query);
            });
            
            if (results.length > 0) {
                const html = results.map(item => `
                    <a href="${item.url}" class="search-result-item">
                        <i class="bi bi-file-text"></i>
                        <span class="search-result-title">${item.title}</span>
                    </a>
                `).join('');
                $searchResults.html(html).addClass('active');
            } else {
                $searchResults.html('<div class="search-no-results">No results found</div>').addClass('active');
            }
        });
        
        // Close search results when clicking outside
        $(document).on('click', function(e) {
            if (!$searchInput.is(e.target) && !$searchResults.is(e.target) && !$searchResults.has(e.target).length) {
                $searchResults.removeClass('active');
            }
        });
        
        // Keyboard shortcut: Cmd/Ctrl + K
        $(document).on('keydown', function(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                $searchInput.focus();
            }
        });
    }

    // ==========================================
    // Tab Component
    // ==========================================
    function initTabs() {
        // Using Bootstrap's native tab functionality
        // This is just for any custom tab containers
        const $tabContainers = $('.tabs');
        
        $tabContainers.each(function() {
            const $container = $(this);
            const $buttons = $container.find('.tab-button');
            const $contents = $container.find('.tab-content');
            
            $buttons.on('click', function() {
                const index = $buttons.index(this);
                
                $buttons.removeClass('active');
                $contents.removeClass('active');
                
                $(this).addClass('active');
                $contents.eq(index).addClass('active');
            });
        });
    }

    // ==========================================
    // Lazy Load Images
    // ==========================================
    function initLazyLoad() {
        const $images = $('img[data-src]');
        
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const $img = $(entry.target);
                        $img.attr('src', $img.data('src'));
                        $img.removeAttr('data-src');
                        imageObserver.unobserve(entry.target);
                    }
                });
            });
            
            $images.each(function() {
                imageObserver.observe(this);
            });
        } else {
            // Fallback - load all images immediately
            $images.each(function() {
                const $img = $(this);
                $img.attr('src', $img.data('src'));
                $img.removeAttr('data-src');
            });
        }
    }

    // ==========================================
    // Utility: Scroll to Top
    // ==========================================
    window.scrollToTop = function() {
        $('html, body').animate({ scrollTop: 0 }, 500);
    };

    // ==========================================
    // Keyboard Shortcuts
    // ==========================================
    $(document).on('keydown', function(e) {
        // Close modals with Escape
        if (e.key === 'Escape') {
            // Bootstrap handles this natively for modals
            // This is for any custom overlays
            $('.search-results').removeClass('active');
        }
    });

})(jQuery);
