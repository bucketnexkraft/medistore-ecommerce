(function ($) {
    "use strict";

    //slider
    let sliderOne = new Swiper('.ot-slider-active', {
        slidesPerView: 1,
        loop: true,
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        speed: 2000,
        effect: 'fade',
        fadeEffect: {
            crossFade: true,
        },
        navigation: {
            prevEl: '.ot-prev',
            nextEl: '.ot-next',
        }
    });

    // Testimonial style 1
    if ($('.ot-testimonial-main-active').length) {
        let testimonialPersons = $('.ot-testimonial-person');
        let syncTestimonialPerson = function (swiper) {
            let activeSlide = $(swiper.slides[swiper.activeIndex]);
            let personIndex = activeSlide.data('testimonial-person');

            if (personIndex === undefined) {
                personIndex = swiper.realIndex;
            }

            testimonialPersons
                .removeClass('is-active')
                .filter('[data-testimonial-person="' + personIndex + '"]')
                .addClass('is-active');
        };

        let testimonialMain = new Swiper('.ot-testimonial-main-active', {
            slidesPerView: 1,
            loop: true,
            speed: 900,
            effect: 'slide',
            spaceBetween: 24,
            grabCursor: true,
            autoplay: {
                delay: 4500,
                disableOnInteraction: false,
            },
            navigation: {
                prevEl: '.ot-testimonial-prev',
                nextEl: '.ot-testimonial-next',
            },
            on: {
                init: function () {
                    syncTestimonialPerson(this);
                },
                slideChange: function () {
                    syncTestimonialPerson(this);
                },
            },
        });

        testimonialPersons.on('click', function () {
            testimonialMain.slideToLoop($(this).data('testimonial-person'));
        });
    }

    //Testimonial
    let testiSlider = new Swiper('.ot-testimonial-active', {
        slidesPerView: 5,
        loop: true,
        autoplay: {
            delay: 3000,
            disableOnInteraction: false,
        },
        speed: 2000,
        effect: 'slide',
        spaceBetween: 12,
        centeredSlides: true,
        breakpoints: {
            1600: {
                slidesPerView: 5,
            },
            1400: {
                slidesPerView: 4,
            },
            1200: {
                slidesPerView: 3,
            },
            992: {
                slidesPerView: 2.5,
            },
            768: {
                slidesPerView: 2,
            },
            576: {
                slidesPerView: 1,
            },
            0: {
                slidesPerView: 1,
            },
        },
        navigation: {
            prevEl: '.ot-prev',
            nextEl: '.ot-next',
        },

    });

    //Blog
    let blogSlider = new Swiper('.ot-blog-active', {
        slidesPerView: 3,
        loop: true,
        autoplay: false,
        speed: 2000,
        effect: 'slide',
        spaceBetween: 24,
        breakpoints: {
            '1600': {
                slidesPerView: 3,
            },
            '1400': {
                slidesPerView: 3,
            },
            '1200': {
                slidesPerView: 3,
            },
            '992': {
                slidesPerView: 2,
            },
            '768': {
                slidesPerView: 2,
            },
            '576': {
                slidesPerView: 1,
            },
            '0': {
                slidesPerView: 1,
            },
        },
        navigation: {
            prevEl: '.ot-prev',
            nextEl: '.ot-next',
        }

    });

    // text-slider-1
    let TextSlide = new Swiper(".rolling-active", {
        slidesPerView: 'auto',
        spaceBetween: 30,
        freemode: true,
        centeredSlides: true,
        loop: true,
        speed: 4000,
        allowTouchMove: false,
        autoplay: {
            delay: 0,
            disableOnInteraction: true,
        }
    });

    // brand-slider-1
    let brandSlide = new Swiper(".brand-rolling-active", {
        loop: true,
        freemode: true,
        slidesPerView: 'auto',
        spaceBetween: 0,
        centeredSlides: true,
        allowTouchMove: false,
        speed: 4000,
        autoplay: {
            delay: 0,
            disableOnInteraction: true,
        },
    });

    //slider
    let postBox = new Swiper('.postbox-slider-active', {
        slidesPerView: 1,
        loop: true,
        autoplay: true,
        speed: 2000,
        effect: 'fade',
        fadeEffect: {
            crossFade: true,
        },
        breakpoints: {
            '1600': {
                slidesPerView: 1,
            },
            '1400': {
                slidesPerView: 1,
            },
            '1200': {
                slidesPerView: 1,
            },
            '992': {
                slidesPerView: 1,
            },
            '768': {
                slidesPerView: 1,
            },
            '576': {
                slidesPerView: 1,
            },
            '0': {
                slidesPerView: 1,
            },
        },
        navigation: {
            prevEl: '.ot-prev',
            nextEl: '.ot-next',
        }

    });

})(jQuery);
