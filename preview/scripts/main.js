(function($) {

  // Reusables
  var $templateSelect = $('#template-select'),
    $body = $('body'),
    h = document.location.hash,
    drawerCookieName = 'mobile-drawer-hidden';

  // Initilize Select2
  $templateSelect.select2({matcher: modelMatcher});
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
      var items = '';
      var currentGroup = data[0].substr(0, data[0].indexOf('/'));
      console.log(currentGroup);
      items += "<optgroup label='"+currentGroup+"'>";
      $.each( data, function( key, val ) {
        var groupName = val.substr(0, val.indexOf('/'));
        var fileName = val.substring(val.lastIndexOf('/') + 1);
        if(currentGroup != groupName) {
          currentGroup = groupName;
          items += "<optgroup label='"+currentGroup+"'>";
        }
        items += "<option value='/dist/" + val + "' data-subject='" + fileName + "'>" + fileName + "</option>";
      });
      items += "</optgroup>";

      $templateSelect.append(items);

      // Preload selected template from hashed template:
      if (h && h.indexOf('template:') != -1) {
        var tpl = h.split(':')[1];

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

function modelMatcher (params, data) {
  data.parentText = data.parentText || "";

  // Always return the object if there is nothing to compare
  if ($.trim(params.term) === '') {
    return data;
  }

  // Do a recursive check for options with children
  if (data.children && data.children.length > 0) {
    // Clone the data object if there are children
    // This is required as we modify the object to remove any non-matches
    var match = $.extend(true, {}, data);

    // Check each child of the option
    for (var c = data.children.length - 1; c >= 0; c--) {
      var child = data.children[c];
      child.parentText += data.parentText + " " + data.text;

      var matches = modelMatcher(params, child);

      // If there wasn't a match, remove the object in the array
      if (matches == null) {
        match.children.splice(c, 1);
      }
    }

    // If any children matched, return the new object
    if (match.children.length > 0) {
      return match;
    }

    // If there were no matching children, check just the plain object
    return modelMatcher(params, match);
  }

  // If the typed-in term matches the text of this term, or the text from any
  // parent term, then it's a match.
  var original = (data.parentText + ' ' + data.text).toUpperCase();
  var term = params.term.toUpperCase();


  // Check if the text contains the term
  if (original.indexOf(term) > -1) {
    return data;
  }

  // If it doesn't contain the term, don't return anything
  return null;
}
