/*
 * 법률 문서 한/영 전환기 — 2026-09-02
 *
 * 이 저장소의 문서는 페이지 하나에 한국어와 영어를 위아래로 같이 담는다.
 * 페이지마다 마크업이 조금씩 다르고(어떤 곳은 <section class="ko">,
 * 어떤 곳은 감싼 요소가 아예 없음) 빌드 단계도 없으므로, HTML 을 다시
 * 짜는 대신 이 스크립트가 실행 시점에 <h1> 을 기준으로 언어 덩어리를
 * 나누고 전환 버튼을 붙인다.
 *
 * 자바스크립트가 꺼져 있으면 지금처럼 두 언어가 모두 보인다. 법률 문서는
 * 읽히는 것이 우선이므로 그 상태가 기본값이고 안전한 실패다.
 */
(function () {
  'use strict';

  var STORE_KEY = 'ctc-legal-lang';

  function hangulRatio(text) {
    var hangul = (text.match(/[가-힣]/g) || []).length;
    var latin = (text.match(/[A-Za-z]/g) || []).length;
    if (hangul + latin === 0) return 0;
    return hangul / (hangul + latin);
  }

  /*
   * 페이지마다 감싸는 요소가 다르다. 어떤 문서는 <body> 바로 아래에 <h1> 이
   * 있고, 어떤 문서는 <main> 안에 한국어가 펼쳐진 채 영어만 <section class="en">
   * 으로 묶여 있다. 그래서 <h1> 들의 가장 가까운 공통 조상을 먼저 찾고,
   * 그 조상 바로 아래 자식 가운데 어느 것이 각 <h1> 을 품고 있는지를 기준으로
   * 덩어리를 나눈다. 이러면 두 배치 모두에서 같은 결과가 나온다.
   */
  function commonAncestor(elements) {
    var ancestor = elements[0];
    for (var i = 1; i < elements.length; i++) {
      while (ancestor && !ancestor.contains(elements[i])) ancestor = ancestor.parentElement;
    }
    return ancestor;
  }

  function collectGroups() {
    var headings = Array.prototype.slice.call(document.querySelectorAll('h1'));
    if (headings.length < 2) return [];

    var root = commonAncestor(headings);
    if (!root) return [];

    // 각 <h1> 을 품은, root 바로 아래 자식을 구간 시작점으로 삼는다.
    var markers = [];
    for (var i = 0; i < headings.length; i++) {
      var node = headings[i];
      while (node.parentElement && node.parentElement !== root) node = node.parentElement;
      if (node.parentElement === root && markers.indexOf(node) === -1) markers.push(node);
    }
    if (markers.length < 2) return [];

    var groups = [];
    var current = null;
    var children = Array.prototype.slice.call(root.children);
    for (var c = 0; c < children.length; c++) {
      var child = children[c];
      if (child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
      if (markers.indexOf(child) !== -1) {
        current = { nodes: [], text: '', heading: child };
        groups.push(current);
      }
      if (!current) continue;   // 첫 <h1> 앞의 머리말은 공통이므로 숨기지 않는다
      current.nodes.push(child);
      current.text += ' ' + (child.textContent || '');
    }
    return groups;
  }

  function apply(groups, mode) {
    for (var i = 0; i < groups.length; i++) {
      var show = mode === 'both' || groups[i].lang === mode;
      for (var j = 0; j < groups[i].nodes.length; j++) {
        groups[i].nodes[j].hidden = !show;
      }
    }
  }

  function build() {
    var groups = collectGroups();
    if (groups.length < 2) return; // 언어가 하나뿐인 안내 페이지

    for (var i = 0; i < groups.length; i++) {
      groups[i].lang = hangulRatio(groups[i].text) > 0.25 ? 'ko' : 'en';
      // 각 덩어리의 제목에 실제 언어를 표시해 스크린리더와 번역기가
      // 두 언어를 섞어 읽지 않게 한다.
      groups[i].heading.setAttribute('lang', groups[i].lang);
    }

    var hasKo = false, hasEn = false;
    for (var k = 0; k < groups.length; k++) {
      if (groups[k].lang === 'ko') hasKo = true;
      else hasEn = true;
    }
    if (!hasKo || !hasEn) return; // 두 언어가 다 있을 때만 전환기를 붙인다

    var style = document.createElement('style');
    style.textContent =
      '.lang-switch{display:flex;gap:8px;align-items:center;flex-wrap:wrap;' +
      'margin:0 0 26px;padding:10px 12px;border:1px solid #dbc9b8;border-radius:10px;' +
      'background:#fffdf8}' +
      '.lang-switch b{font-size:12px;font-weight:700;color:#6f625a;margin-right:2px}' +
      '.lang-switch button{font:inherit;font-size:13px;padding:6px 14px;cursor:pointer;' +
      'border:1px solid #dbc9b8;border-radius:999px;background:#fff;color:#29231f}' +
      '.lang-switch button:hover{border-color:#a75f3e}' +
      '.lang-switch button[aria-pressed="true"]{background:#a75f3e;border-color:#a75f3e;' +
      'color:#fff;font-weight:700}';
    document.head.appendChild(style);

    var bar = document.createElement('nav');
    bar.className = 'lang-switch';
    bar.setAttribute('aria-label', 'Language / 언어');
    var label = document.createElement('b');
    label.textContent = 'Language / 언어';
    bar.appendChild(label);

    var options = [
      { mode: 'ko', text: '한국어' },
      { mode: 'en', text: 'English' },
      { mode: 'both', text: '둘 다 / Both' }
    ];
    var buttons = [];

    function select(mode, persist) {
      apply(groups, mode);
      document.documentElement.setAttribute('lang', mode === 'both' ? 'ko' : mode);
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].setAttribute(
          'aria-pressed', buttons[b].dataset.mode === mode ? 'true' : 'false');
      }
      if (persist) {
        try { localStorage.setItem(STORE_KEY, mode); } catch (e) { /* 저장 불가여도 동작 */ }
      }
    }

    for (var o = 0; o < options.length; o++) {
      (function (option) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = option.text;
        button.dataset.mode = option.mode;
        button.addEventListener('click', function () { select(option.mode, true); });
        bar.appendChild(button);
        buttons.push(button);
      })(options[o]);
    }

    // 문서 카드 안, 첫 언어 덩어리 바로 앞에 놓는다. body 맨 위에 두면
    // 페이지 테두리 밖에 떠 있는 것처럼 보인다.
    var anchor = groups[0].nodes[0];
    anchor.parentElement.insertBefore(bar, anchor);

    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) { /* 무시 */ }
    if (saved !== 'ko' && saved !== 'en' && saved !== 'both') {
      saved = (navigator.language || '').toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
    }
    select(saved, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
