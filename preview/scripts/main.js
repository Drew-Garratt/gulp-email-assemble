(function($) {

  // Reusables
  var $templateSelect = $('#template-select'),
    $body = $('body'),
    h = document.location.hash,
    drawerCookieName = 'mobile-drawer-hidden';
    
  // Fetch Mail Json
  getEmails();

  // On change, reload template
  $templateSelect.on('change', function() {
    var $s = $(this),
      v = $s.val(),
      ms = new Date().getTime();  // We'll timestamp each iframe load for cache-busting

    if (!v)
      return;
    
    $('iframe').attr('src', v + '?t=' + ms);
    document.location.hash = 'template:' + v;

  });

  // Mobile Preview Drawer
  function mobilePreviewDrawer() {
    var $toggleBtns = $('.js-drawer-toggle'),
      $mobileDrawer = $('#mobile-drawer'),
      drawerHiddenClass = 'mobile-drawer-hidden';

    $toggleBtns.on('click', function() {

      $body.toggleClass(drawerHiddenClass);

      // Remember via cookie the drawer state
      if ($body.hasClass(drawerHiddenClass)) {
        setCookie(drawerCookieName, 1, 30);
      } else {
        setCookie(drawerCookieName, 1, -30);
      }

    });
  }

  mobilePreviewDrawer();

  // Close the drawer onload if we have the cookie
  if (getCookie(drawerCookieName)) {
    $('.js-drawer-toggle:eq(0)').trigger('click');
  }

  // Debounce helper
  // url: http://davidwalsh.name/javascript-debounce-function
  function _debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };
  
  //Get email list
  function getEmails() {
    $.getJSON( "scripts/emails.json", function( data ) {
      $('option:gt(0)', $templateSelect).remove();
      var items = [];
      $.each( data, function( key, val ) {
        var fileName = val.substring(val.lastIndexOf('/') + 1);
        items.push( "<option value='/dist/" + val + "' data-subject='" + fileName + "'>" + val + "</option>" );
      });
     
      $templateSelect.append(items);
      
      // Preload selected template from hashed template:
      if (h && h.indexOf('template:') != -1) {
        var tpl = h.split(':')[1];
        
        console.log(tpl);
    
        $templateSelect.val(tpl).trigger('change');
    
      }
    });
  }

  // iFrame Sizing
  function resizeUi() {
    var headerHeight = $('#header').height(),
      windowHeight = $(window).height(),
      uiHeightAvail = windowHeight - headerHeight,
      $fullHeightEls = $('.preview-ui, .preview-ui--full, .preview-ui--full iframe, .preview-ui--mobile');

    $fullHeightEls.height(uiHeightAvail);
  }

  // Debouce UI resizing
  var resizeUiDebouced = _debounce(function() {
    resizeUi();
  }, 200);

  window.addEventListener('resize', resizeUiDebouced);

  // Trigger UI resize since the page is painted
  resizeUi();

})(jQuery);


function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
}

function checkCookie() {
    var user = getCookie("username");
    if (user != "") {
        alert("Welcome again " + user);
    } else {
        user = prompt("Please enter your name:", "");
        if (user != "" && user != null) {
            setCookie("username", user, 365);
        }
    }
}