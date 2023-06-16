$(window).load(function () {
    $(document).on("scroll", onScroll);

    //smoothscroll
    $('.scroll-icon').on('click', function (e) {
        e.preventDefault();
        $(this).addClass('active');

        var target = this.hash,
            menu = target;
        $target = $(target);
        $('html, body').stop().animate({
            'scrollTop': $target.offset().top + 2
        }, 1000, 'swing', function () {
            window.location.hash = target;
        });
    });

    $('.sf-menu').find('a[href^="#"]').on('click', function (e) {
        e.preventDefault();
        $(this).addClass('active');

        var target = this.hash,
            menu = target;
        $target = $(target);
        $('html, body').stop().animate({
            'scrollTop': $target.offset().top + 2
        }, 1000, 'swing', function () {
            window.location.hash = target;
        });
    });
});


function onScroll(event) {
    var scrollPos = $(document).scrollTop();

    if(((scrollPos + $(window).height()) > ($(document).height() - 100)) &&
        $($('.sf-menu > li:last-child > a[href^="#"]').attr('href')).length > 0
    ){
        $('.sf-menu li').removeClass("active");
        $('.sf-menu li:last-child').addClass("active");
        return;
    }

    $('.sf-menu').find('a[href^="#"]').each(function () {
        var currLink = $(this);
        try {
            var refElement = $(currLink.attr("href"));
            if (refElement.length > 0) {
                if ((refElement.position().top - 20) <= scrollPos && refElement.position().top + refElement.height() > scrollPos) {
                    currLink.parent().parent().find('li').removeClass("active");
                    currLink.parent().addClass("active");
                }
            }
        } catch (ex){}
        
    });
}

