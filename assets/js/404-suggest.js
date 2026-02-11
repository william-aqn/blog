(function () {
  'use strict';

  var MIN_WORD_LENGTH = 3;
  var STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'how', 'that', 'this', 'not', 'are', 'was', 'but'
  ]);
  var MIN_SCORE_SHORT_SLUG = 1;
  var MIN_SCORE_LONG_SLUG = 2;
  var BEST_MATCH_RATIO = 0.6;
  var SUGGESTION_HEADER_TEXT = 'Возможно, вы искали:';

  var CSS_BEST = 'match-best';
  var CSS_PARTIAL = 'match-partial';
  var CSS_NONE = 'match-none';
  var CSS_HAS_SUGGESTIONS = 'has-suggestions';
  var CSS_DIVIDER = 'suggestion-divider';
  var CSS_HEADER = 'suggest-header';

  function extractSlugWords(pathname) {
    var filename = pathname.split('/').pop() || '';
    var slug = filename.replace(/\.html?$/, '');
    if (!slug) return [];
    return slug.split('-');
  }

  function filterWords(words) {
    var filtered = words.filter(function (w) {
      return w.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(w.toLowerCase());
    });
    if (filtered.length === 0) {
      filtered = words.filter(function (w) {
        return !STOP_WORDS.has(w.toLowerCase());
      });
    }
    return filtered;
  }

  function scorePost(href, slugWords) {
    var postFilename = href.split('/').pop() || '';
    var postSlug = postFilename.replace(/\.html?$/, '');
    var postWords = new Set(postSlug.split('-'));
    var score = 0;
    slugWords.forEach(function (word) {
      if (postWords.has(word.toLowerCase())) {
        score++;
      }
    });
    return score;
  }

  var slugWords = extractSlugWords(window.location.pathname);
  var filteredWords = filterWords(slugWords);

  if (filteredWords.length === 0) return;

  var list = document.querySelector('#blog_post_list ul');
  if (!list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('li'));
  var minScore = filteredWords.length <= 2 ? MIN_SCORE_SHORT_SLUG : MIN_SCORE_LONG_SLUG;

  var scored = items.map(function (li, index) {
    var a = li.querySelector('a');
    var href = a ? a.getAttribute('href') : '';
    var score = scorePost(href, filteredWords);
    var ratio = filteredWords.length > 0 ? score / filteredWords.length : 0;
    return { li: li, score: score, ratio: ratio, index: index };
  });

  var hasMatches = scored.some(function (s) { return s.score >= minScore; });
  if (!hasMatches) return;

  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  scored.forEach(function (s) {
    if (s.score >= minScore && s.ratio >= BEST_MATCH_RATIO) {
      s.li.classList.add(CSS_BEST);
    } else if (s.score >= minScore) {
      s.li.classList.add(CSS_PARTIAL);
    } else {
      s.li.classList.add(CSS_NONE, CSS_HAS_SUGGESTIONS);
    }
  });

  var header = document.createElement('p');
  header.className = CSS_HEADER;
  header.textContent = SUGGESTION_HEADER_TEXT;
  list.parentNode.insertBefore(header, list);

  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }

  var dividerInserted = false;
  scored.forEach(function (s) {
    if (!dividerInserted && s.score < minScore) {
      var divider = document.createElement('li');
      divider.className = CSS_DIVIDER;
      list.appendChild(divider);
      dividerInserted = true;
    }
    list.appendChild(s.li);
  });
})();
