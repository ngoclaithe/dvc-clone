/* ===================================================
   Cổng Dịch vụ công Quốc gia - JavaScript
   =================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ===== MOBILE NAVIGATION =====
    initMobileNav();

    // ===== DROPDOWN NAVIGATION (Mobile) =====
    initDropdowns();

    // ===== NEWS SLIDER =====
    initNewsSlider();

    // ===== SCROLL ANIMATIONS =====
    initScrollAnimations();

    // ===== SEARCH FUNCTIONALITY =====
    initSearch();
});

// ----- Mobile Navigation -----
function initMobileNav() {
    const toggle = document.getElementById('mobile-toggle');
    const navList = document.getElementById('nav-list');

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);

    function openNav() {
        navList.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeNav() {
        navList.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    toggle.addEventListener('click', () => {
        if (navList.classList.contains('active')) {
            closeNav();
        } else {
            openNav();
        }
    });

    overlay.addEventListener('click', closeNav);

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeNav();
    });
}

// ----- Mobile Dropdowns -----
function initDropdowns() {
    const dropdownItems = document.querySelectorAll('.nav-item.has-dropdown');

    dropdownItems.forEach(item => {
        const link = item.querySelector('.nav-link');

        link.addEventListener('click', (e) => {
            // Only on mobile
            if (window.innerWidth <= 768) {
                e.preventDefault();
                item.classList.toggle('open');

                // Close others
                dropdownItems.forEach(other => {
                    if (other !== item) other.classList.remove('open');
                });
            }
        });
    });
}

// ----- News Slider -----
function initNewsSlider() {
    const track = document.getElementById('news-track');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    const dotsContainer = document.getElementById('slider-dots');

    if (!track) return;

    const items = track.querySelectorAll('.news-item');
    const totalItems = items.length;

    let currentPage = 0;
    let itemsPerPage = getItemsPerPage();
    let totalPages = Math.ceil(totalItems / itemsPerPage);

    function getItemsPerPage() {
        if (window.innerWidth <= 768) return 1;
        if (window.innerWidth <= 992) return 3;
        return 4;
    }

    // Create dots
    function createDots() {
        dotsContainer.innerHTML = '';
        for (let i = 0; i < totalPages; i++) {
            const dot = document.createElement('button');
            dot.className = 'slider-dot' + (i === currentPage ? ' active' : '');
            dot.setAttribute('aria-label', `Trang ${i + 1}`);
            dot.addEventListener('click', () => goToPage(i));
            dotsContainer.appendChild(dot);
        }
    }

    function updateDots() {
        const dots = dotsContainer.querySelectorAll('.slider-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentPage);
        });
    }

    function goToPage(page) {
        currentPage = page;
        const itemWidth = 100 / itemsPerPage;
        const offset = currentPage * itemsPerPage * itemWidth;
        track.style.transform = `translateX(-${offset}%)`;
        updateDots();
    }

    function nextSlide() {
        currentPage = (currentPage + 1) % totalPages;
        goToPage(currentPage);
    }

    function prevSlide() {
        currentPage = (currentPage - 1 + totalPages) % totalPages;
        goToPage(currentPage);
    }

    // Set item widths
    function updateLayout() {
        itemsPerPage = getItemsPerPage();
        totalPages = Math.ceil(totalItems / itemsPerPage);
        const itemWidth = 100 / itemsPerPage;

        items.forEach(item => {
            item.style.flex = `0 0 ${itemWidth}%`;
        });

        if (currentPage >= totalPages) {
            currentPage = totalPages - 1;
        }
        createDots();
        goToPage(currentPage);
    }

    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);

    // Auto-slide
    let autoSlideInterval = setInterval(nextSlide, 5000);

    // Pause on hover
    const sliderWrapper = track.closest('.news-slider-wrapper');
    if (sliderWrapper) {
        sliderWrapper.addEventListener('mouseenter', () => {
            clearInterval(autoSlideInterval);
        });
        sliderWrapper.addEventListener('mouseleave', () => {
            autoSlideInterval = setInterval(nextSlide, 5000);
        });
    }

    // Touch support
    let touchStartX = 0;
    let touchEndX = 0;

    track.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        clearInterval(autoSlideInterval);
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;
        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        autoSlideInterval = setInterval(nextSlide, 5000);
    }, { passive: true });

    // Resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateLayout, 200);
    });

    // Init
    updateLayout();
}

// ----- Scroll Animations (Intersection Observer) -----
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe service items
    document.querySelectorAll('.service-item').forEach(item => {
        observer.observe(item);
    });

    // Observe hero cards
    document.querySelectorAll('.hero-card').forEach(card => {
        observer.observe(card);
    });
}

// ----- Search -----
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (!searchInput || !searchBtn) return;

    function performSearch() {
        const query = searchInput.value.trim();
        if (query) {
            alert(`Tìm kiếm: "${query}"\n\n(Đây là giao diện demo học tập, chức năng tìm kiếm chưa được kết nối)`);
        }
    }

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
}

// ----- Advanced Search Modal -----
function openAdvSearchModal() {
    const modal = document.getElementById('adv-search-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('txtKEYWORD');
        if (input) input.focus();
    }, 300);
}

function closeAdvSearchModal() {
    const modal = document.getElementById('adv-search-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function doAdvSearch() {
    const keyword = document.getElementById('txtKEYWORD').value.trim();
    const capThucHien = document.querySelector('input[name="cap_thuc_hien"]:checked');

    if (!keyword) {
        alert('Bạn vui lòng nhập từ khóa tìm kiếm!');
        return;
    }

    const tinhThanh = document.getElementById('cboTINH_THANH');
    const selectedTinh = tinhThanh.options[tinhThanh.selectedIndex].text;

    let message = `Tìm kiếm nâng cao:\n`;
    message += `- Từ khóa: "${keyword}"\n`;
    message += `- Cấp: ${capThucHien.value === 'tinhthanhpho' ? 'Tỉnh/Thành phố' : 'Bộ ngành'}\n`;
    if (tinhThanh.value !== '-1') {
        message += `- Địa phương: ${selectedTinh}\n`;
    }
    message += `\n(Đây là giao diện demo học tập, chức năng tìm kiếm chưa được kết nối)`;

    alert(message);
    closeAdvSearchModal();
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('adv-search-modal');
    if (modal && e.target === modal) {
        closeAdvSearchModal();
    }
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('adv-search-modal');
        if (modal && modal.classList.contains('active')) {
            closeAdvSearchModal();
        }
    }
});

// Radio toggle for bo nganh / tinh thanh
document.addEventListener('DOMContentLoaded', () => {
    const rdoTinhThanh = document.getElementById('rdoTINH_THANH');
    const rdoBoNganh = document.getElementById('rdoBO_NGANH');
    const hideForBoNganh = document.getElementById('hide_for_bo_nganh');

    if (rdoTinhThanh && rdoBoNganh && hideForBoNganh) {
        rdoTinhThanh.addEventListener('change', () => {
            hideForBoNganh.style.display = 'block';
        });

        rdoBoNganh.addEventListener('change', () => {
            hideForBoNganh.style.display = 'none';
        });
    }
});
