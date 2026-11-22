(function ($) {
  "use strict";
  /*=================================
      JS Index Here
  ==================================*/
  /*
  01. On Load Function
  02. Common Js
  03. Mobile Menu Js
  04. Counter
  05. MagnificPopup img view
  06. MagnificPopup video view
  07. Scroll To Top
  08. Smooth Scroll Js
  09. Scroll Wrapper Js
  10. Sticky Header Js
  11. Offcanvas Js
  12. Nice Select Js
  13. Faq-class-active
  14. Title-animation
  15. Text-animation
  16. Fade-Animation
  17. Ecommerce
  18. image reveal
  19. Pricing-switch & Tab
  20. Skill js
  21. Before after image
  22. Footer Text Animation
  23. Passowrd
  */
  /*=================================
      JS Index End
  ==================================*/
  /*

// /*---------- 01. On Load Function ----------*/
//   let windowOn = $(window);
//   $(window).on("load", function () {
//     $(".preloader").fadeOut();
//   });

  /*----------- 02. Common Js ----------*/
  $("[data-background]").each(function () {
    $(this).css("background-image", "url( " + $(this).attr("data-background") + "  )");
  });

  if ($('[data-mask-src]').length > 0) {
    $('[data-mask-src]').each(function () {
      let mask = $(this).attr('data-mask-src');
      $(this).css({
        'mask-image': 'url(' + mask + ')',
        '-webkit-mask-image': 'url(' + mask + ')'
      });
      $(this).addClass('bg-mask');
      $(this).removeAttr('data-mask-src');
    });
  };

  $("[data-width]").each(function () {
    $(this).css("width", $(this).attr("data-width"));
  });

  $("[data-bg-color]").each(function () {
    $(this).css("background-color", $(this).attr("data-bg-color"));
  });

  $("[data-text-color]").each(function () {
    $(this).css("color", $(this).attr("data-text-color"));
  });

  /*----------- Feature card cursor tilt ----------*/
  const featureCards = document.querySelectorAll('.ot-feature-card');
  const canTiltFeatureCards = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (featureCards.length && canTiltFeatureCards) {
    featureCards.forEach((card) => {
      let tiltFrame;

      const updateTilt = (clientX, clientY) => {
        const rect = card.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        const rotateX = ((0.5 - y) * 10).toFixed(2);
        const rotateY = ((x - 0.5) * 12).toFixed(2);

        card.style.setProperty('--feature-rotate-x', `${rotateX}deg`);
        card.style.setProperty('--feature-rotate-y', `${rotateY}deg`);
      };

      card.addEventListener('pointerenter', () => {
        card.classList.add('is-tilting');
      });

      card.addEventListener('pointermove', (event) => {
        const clientX = event.clientX;
        const clientY = event.clientY;

        if (tiltFrame) {
          cancelAnimationFrame(tiltFrame);
        }

        tiltFrame = requestAnimationFrame(() => updateTilt(clientX, clientY));
      });

      card.addEventListener('pointerleave', () => {
        if (tiltFrame) {
          cancelAnimationFrame(tiltFrame);
        }

        card.classList.remove('is-tilting');
        card.style.setProperty('--feature-rotate-x', '0deg');
        card.style.setProperty('--feature-rotate-y', '0deg');
      });
    });
  }

  /*-----------  03. Mobile Menu Js ----------*/
  let atMenuWrap = $('.ot-mobile-menu-active > ul').clone();
  let atSideMenu = $('.ot-offcanvas-menu nav');
  atSideMenu.append(atMenuWrap);
  if ($(atSideMenu).find('.ot-submenu, .ot-mega-menu').length != 0) {
    $(atSideMenu).find('.ot-submenu, .ot-mega-menu').parent().append
      ('<button class="ot-menu-close"><i class="fa-solid fa-chevron-right"></i></button>');
  }
  let sideMenuList =
    $('.ot-offcanvas-menu nav > ul > li button.ot-menu-close, .ot-offcanvas-menu nav > ul li.has-dropdown > a');
  $(sideMenuList).on('click', function (e) {
    e.preventDefault();
    if (!($(this).parent().hasClass('active'))) {
      $(this).parent().addClass('active');
      $(this).siblings('.ot-submenu, .ot-mega-menu').slideDown();
    } else {
      $(this).siblings('.ot-submenu, .ot-mega-menu').slideUp();
      $(this).parent().removeClass('active');
    }
  });

  /*---------- 04. Counter --------- */
  new PureCounter();
  new PureCounter({
    filesizing: true,
    selector: ".filesizecount",
    pulse: 2,
  });

  // /*---------- 05. MagnificPopup img view  --------*/
  // $('.popup-image').magnificPopup({
  //   type: 'image',
  //   gallery: {
  //     enabled: true
  //   }
  // });

  // /*---------- 06. MagnificPopup video view  ----------*/
  // $(".popup-video").magnificPopup({
  //   type: "iframe",
  // });

  /*---------- 07. Scroll To Top ----------*/
  $(document).ready(function () {
    if ($('.scroll-top').length > 0) {
      let scrollTopbtn = $('.scroll-top')[0];
      let progressPath = $('.scroll-top path')[0];
      let pathLength = progressPath.getTotalLength();

      // Initialize stroke-dasharray and stroke-dashoffset for the progress path
      progressPath.style.transition = progressPath.style.WebkitTransition = 'none';
      progressPath.style.strokeDasharray = pathLength + ' ' + pathLength;
      progressPath.style.strokeDashoffset = pathLength;
      progressPath.getBoundingClientRect();
      progressPath.style.transition = progressPath.style.WebkitTransition = 'stroke-dashoffset 10ms linear';

      // Update the progress bar
      let updateProgress = function () {
        let scroll = $(window).scrollTop();
        let height = $(document).height() - $(window).height();
        let progress = pathLength - (scroll * pathLength / height);
        progressPath.style.strokeDashoffset = progress;
      };
      updateProgress();

      $(window).on('scroll', updateProgress);

      let offset = 40;
      let duration = 750;

      // Show the scroll-to-top button on scroll
      $(window).on('scroll', function () {
        if ($(this).scrollTop() > offset) {
          $(scrollTopbtn).addClass('show');
        } else {
          $(scrollTopbtn).removeClass('show');
        }
      });

      // Click event to scroll to top
      $(scrollTopbtn).on('click', function (event) {
        event.preventDefault();
        $('html, body').animate({
          scrollTop: 0
        }, duration);
        return false;
      });
    }
  });

  /*----------- 08. Smooth Scroll Js -----------*/
  function smoothSctoll() {
    $('.smooth a').on('click', function (event) {
      let target = $(this.getAttribute('href'));
      if (target.length) {
        event.preventDefault();
        $('html, body').stop().animate({
          scrollTop: target.offset().top - 60
        }, 1500);
      }
    });
  }
  smoothSctoll();

  /*----------- 09. Scroll Wrapper Js ---------------*/
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother, ScrollToPlugin);

  if (typeof Lenis !== 'undefined') {
    const lenis = new Lenis({
      duration: 1.2,
      lerp: 0.08,
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1.2,
    });
    window.__NEXSTOCK_LANDING_LENIS__ = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const lenisTicker = (time) => {
      lenis.raf(time * 1000);
    };
    window.__NEXSTOCK_LANDING_LENIS_TICKER__ = lenisTicker;
    gsap.ticker.add(lenisTicker);

    gsap.ticker.lagSmoothing(0);

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (event) => {
        const targetId = anchor.getAttribute('href');

        if (!targetId || targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if (!targetElement) return;

        event.preventDefault();
        lenis.scrollTo(targetElement, {
          offset: -60,
          duration: 1.4
        });
      });
    });

    const stickyHeader = document.getElementById('header-sticky');
    let lastScrollY = 0;

    if (stickyHeader) {
      lenis.on('scroll', ({ scroll, direction }) => {
        const currentScroll = scroll || 0;

        if (currentScroll <= 20) {
          stickyHeader.classList.remove('header-sticky', 'header-hidden');
          lastScrollY = currentScroll;
          return;
        }

        stickyHeader.classList.add('header-sticky');

        if (direction === 1 && currentScroll > lastScrollY + 4) {
          stickyHeader.classList.add('header-hidden');
        } else if (direction === -1) {
          stickyHeader.classList.remove('header-hidden');
        }

        lastScrollY = currentScroll;
      });
    }
  }

  if ($('#smooth-wrapper').length && $('#smooth-content').length) {
    ScrollSmoother.create({
      wrapper: "#smooth-wrapper",
      content: "#smooth-content",
      smooth: 1.35,
      effects: true,
      smoothTouch: 0.1
    });
  }

  /*----------- 11. Offcanvas Js ---------------*/
  $(".ot-offcanvas-toogle").on('click', function () {
    $(".ot-offcanvas").addClass("opend");
    $(".body-overlay").addClass("opend");
  });

  $(".ot-offcanvas-close-toggle,.body-overlay").on('click', function () {
    $(".ot-offcanvas").removeClass("opend");
    $(".body-overlay").removeClass("opend");
  });

  // /*------------ 12. Nice Select Js ---------------*/
  // $('select').niceSelect();

  /*------------- 13. Faq-class-active -----------------*/
  $('.ot-faq .accordion-items').on("click", function () {
    $(this).addClass('active').siblings().removeClass('active');
  });

  /*------------- 14. Title-animation ----------------*/
  if ($(".ot-text-anime-1").length) {
    let e = 0.05,
      t = 0.5;
    document.querySelectorAll(".ot-text-anime-1").forEach((a) => {
      let i = new SplitText(a, { type: "chars, words" });
      gsap.from(i.words, { duration: 1, delay: t, x: 20, autoAlpha: 0, stagger: e, scrollTrigger: { trigger: a, start: "top 85%" } });
    });
  }
  if ($(".ot-text-anime-2").length) {
    let e = 0.03,
      t = 20,
      a = 0.1,
      i = "power2.out";
    document.querySelectorAll(".ot-text-anime-2").forEach((n) => {
      let o = new SplitText(n, { type: "chars, words" });
      gsap.from(o.chars, { duration: 2, delay: a, x: t, autoAlpha: 0, stagger: e, ease: i, scrollTrigger: { trigger: n, start: "top 85%" } });
    });
  }
  if ($(".ot-text-anime-3").length) {
    document.querySelectorAll(".ot-text-anime-3").forEach((e) => {
      e.animation && (e.animation.progress(1).kill(), e.split.revert()),
        (e.split = new SplitText(e, { type: "lines,words,chars", linesClass: "split-line" })),
        gsap.set(e, { perspective: 400 }),
        gsap.set(e.split.chars, { opacity: 0, x: "50" }),
        (e.animation = gsap.to(e.split.chars, { scrollTrigger: { trigger: e, start: "top 90%" }, x: "0", y: "0", rotateX: "0", opacity: 1, duration: 1, ease: Back.easeOut, stagger: 0.02 }));
    });
  }

  /*------------- 15. Text-animation ----------------*/
  let splitTitleLines = gsap.utils.toArray(".ot-text-anim");

  splitTitleLines.forEach(splitTextLine => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: splitTextLine,
        start: 'top 90%',
        end: 'bottom 60%',
        scrub: false,
        markers: false,
        toggleActions: 'play none none none'
      }
    });

    const itemSplitted = new SplitText(splitTextLine, { type: "words, lines" });
    gsap.set(splitTextLine, { perspective: 200 });
    itemSplitted.split({ type: "lines" })
    tl.from(itemSplitted.lines, { duration: 1, delay: 0.3, opacity: 0, rotationX: -80, force3D: true, transformOrigin: "top center -50", stagger: 0.1 });
  });

  // /*------------- 16. Fade-Animation ----------------*/
  // if ($(".ot_fade_anim").length > 0) {
  //   gsap.utils.toArray(".ot_fade_anim").forEach((item) => {
  //     let ot_fade_offset = item.getAttribute("data-fade-offset") || 40,
  //       ot_duration_value = item.getAttribute("data-duration") || 0.75,
  //       ot_fade_direction = item.getAttribute("data-fade-from") || "bottom",
  //       ot_onscroll_value = item.getAttribute("data-on-scroll") || 1,
  //       ot_delay_value = item.getAttribute("data-delay") || 0.15,
  //       ot_ease_value = item.getAttribute("data-ease") || "power2.out",
  //       ot_anim_setting = {
  //         opacity: 0,
  //         ease: ot_ease_value,
  //         duration: ot_duration_value,
  //         delay: ot_delay_value,
  //         x: (ot_fade_direction == "left" ? -ot_fade_offset : (ot_fade_direction == "right" ? ot_fade_offset : 0)),
  //         y: (ot_fade_direction == "top" ? -ot_fade_offset : (ot_fade_direction == "bottom" ? ot_fade_offset : 0)),
  //       };
  //     if (ot_onscroll_value == 1) {
  //       ot_anim_setting.scrollTrigger = {
  //         trigger: item,
  //         start: 'top 85%',
  //       };
  //     }
  //     gsap.from(item, ot_anim_setting);
  //   });
  // }

  // /*----------- 19. Pricing-switch & Tab ----------*/
  // $(document).ready(function () {
  //   var e = $("#filt-monthly"),
  //     d = $("#filt-yearly"),
  //     t = $("#switcher"),
  //     m = $("#monthly"),
  //     y = $("#yearly");

  //   if ($('.ot-pricing-tabs').length) {
  //     // Using jQuery to bind click events to the elements
  //     e.on("click", function () {
  //       t.prop("checked", false);
  //       e.addClass("toggler--is-active");
  //       d.removeClass("toggler--is-active");
  //       m.removeClass("hide");
  //       y.addClass("hide");
  //     });

  //     d.on("click", function () {
  //       t.prop("checked", true);
  //       d.addClass("toggler--is-active");
  //       e.removeClass("toggler--is-active");
  //       m.addClass("hide");
  //       y.removeClass("hide");
  //     });

  //     t.on("click", function () {
  //       d.toggleClass("toggler--is-active");
  //       e.toggleClass("toggler--is-active");
  //       m.toggleClass("hide");
  //       y.toggleClass("hide");
  //     });
  //   }
  // });

  // /*----------------- 23. Passowrd ---------------- */
  // if ($('#password-show-toggle').length > 0) {
  //   var btn = document.getElementById('password-show-toggle');
  //   btn.addEventListener('click', function (e) {
  //     var inputType = document.getElementById('ot-password');
  //     var openEye = document.getElementById('open-eye');
  //     var closeEye = document.getElementById('close-eye');

  //     if (inputType.type === "password") {
  //       inputType.type = "text";
  //       openEye.style.display = 'block';
  //       closeEye.style.display = 'none';
  //     } else {
  //       inputType.type = "password";
  //       openEye.style.display = 'none';
  //       closeEye.style.display = 'block';
  //     }
  //   });
  // }

  // if ($('#password-show-toggle2').length > 0) {
  //   var btn = document.getElementById('password-show-toggle2');
  //   btn.addEventListener('click', function (e) {
  //     var inputType = document.getElementById('ot-conferm-passowrd');
  //     var openEye = document.getElementById('open-eye2');
  //     var closeEye = document.getElementById('close-eye2');

  //     if (inputType.type === "password") {
  //       inputType.type = "text";
  //       openEye.style.display = 'block';
  //       closeEye.style.display = 'none';
  //     } else {
  //       inputType.type = "password";
  //       openEye.style.display = 'none';
  //       closeEye.style.display = 'block';
  //     }
  //   });
  // }

})(jQuery);
