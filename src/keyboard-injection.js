(function () {
	'use strict';

	var API_KEY = '__steamKoreanKeyboardInjection';
	var STATE_KEY = '__steamKoreanKeyboardInjectionState';

	var HANGUL_BY_KEY = {
		q: 'ㅂ',
		w: 'ㅈ',
		e: 'ㄷ',
		r: 'ㄱ',
		t: 'ㅅ',
		y: 'ㅛ',
		u: 'ㅕ',
		i: 'ㅑ',
		o: 'ㅐ',
		p: 'ㅔ',
		a: 'ㅁ',
		s: 'ㄴ',
		d: 'ㅇ',
		f: 'ㄹ',
		g: 'ㅎ',
		h: 'ㅗ',
		j: 'ㅓ',
		k: 'ㅏ',
		l: 'ㅣ',
		z: 'ㅋ',
		x: 'ㅌ',
		c: 'ㅊ',
		v: 'ㅍ',
		b: 'ㅠ',
		n: 'ㅜ',
		m: 'ㅡ',
	};

	var SHIFT_HANGUL_BY_KEY = {
		q: 'ㅃ',
		w: 'ㅉ',
		e: 'ㄸ',
		r: 'ㄲ',
		t: 'ㅆ',
		o: 'ㅒ',
		p: 'ㅖ',
	};

	var STYLE_ID = 'steam-korean-keyboard-injection-style';
	var HANGUL_TOGGLE_SENTINEL = '\u12D0';
	var LETTER_KEY_SELECTOR = '.Layout_qwerty [data-key][data-key-row][data-key-col], .Layout_qwerty_int [data-key][data-key-row][data-key-col]';
	var ALTGR_KEY_SELECTOR = '.Layout_qwerty_int [data-key="AltGr"][data-key-row][data-key-col], .Layout_qwerty_int [data-key="' + HANGUL_TOGGLE_SENTINEL + '"][data-key-row][data-key-col]';
	var KEY_SELECTOR = LETTER_KEY_SELECTOR + ', ' + ALTGR_KEY_SELECTOR;
	var HANGUL_LABEL_ATTR = 'data-steam-korean-hangul-label';

	function resolveWindow(target) {
		if (!target) return window;
		if (target.window && target.window.document) return target.window;
		if (target.document && target.document.defaultView) return target.document.defaultView;
		if (target.ownerDocument && target.ownerDocument.defaultView) return target.ownerDocument.defaultView;
		if (target.defaultView) return target.defaultView;
		if (target.document) return target;
		if (target.BrowserWindow && target.BrowserWindow.document) return target.BrowserWindow;
		if (target.m_BrowserWindow && target.m_BrowserWindow.document) return target.m_BrowserWindow;
		if (target.m_browser && target.m_browser.document) return target.m_browser;
		if (target.browser && target.browser.document) return target.browser;
		if (typeof target.GetBrowserWindow === 'function') {
			var browserWindow = target.GetBrowserWindow();
			if (browserWindow && browserWindow.document) return browserWindow;
		}
		return window;
	}

	function ensureStyle(privateDocument) {
		if (!privateDocument || privateDocument.getElementById(STYLE_ID)) return;

		var style = privateDocument.createElement('style');
		style.id = STYLE_ID;
		style.textContent = [
			'.steam-korean-keycap{',
			'display:grid;',
			'grid-template-columns:1fr 1fr;',
			'align-items:center;',
			'justify-items:center;',
			'column-gap:.32em;',
			'min-width:2.2em;',
			'line-height:1;',
			'pointer-events:none;',
			'}',
			'.steam-korean-keycap__hangul{',
			'font-size:.72em;',
			'font-weight:500;',
			'opacity:.62;',
			'pointer-events:none;',
			'}',
		].join('');
		privateDocument.head.appendChild(style);
	}

	function getInnerLabelContainer(keyElement) {
		var inner = Array.prototype.find.call(keyElement.children, function (child) {
			return child.tagName === 'DIV';
		});
		return inner || null;
	}

	function getDirectSpans(inner) {
		if (!inner) return [];
		return Array.prototype.filter.call(inner.children, function (child) {
			return child.tagName === 'SPAN';
		});
	}

	function getPrimaryLabelSpan(keyElement) {
		var inner = getInnerLabelContainer(keyElement);
		var spans = getDirectSpans(inner);
		if (!spans.length) return null;

		var rawKey = keyElement.getAttribute('data-key') || '';
		var restoredKey = rawKey.length === 1 ? rawKey : '';

		return (
			Array.prototype.find.call(spans, function (span) {
				return span.textContent === restoredKey || span.textContent === restoredKey.toUpperCase();
			}) ||
			Array.prototype.find.call(spans, function (span) {
				return !span.className && !span.hasAttribute(HANGUL_LABEL_ATTR);
			}) ||
			spans[0]
		);
	}

	function restoreLegacyKeycap(keyElement) {
		Array.prototype.forEach.call(keyElement.querySelectorAll('.steam-korean-keycap'), function (legacyKeycap) {
			var latin = legacyKeycap.dataset && legacyKeycap.dataset.latin;
			var parent = legacyKeycap.parentElement;
			if (parent) parent.textContent = latin || '';
		});
	}

	function getSteamAltGrClassName(keyElement, inner, primarySpan) {
		var spans = getDirectSpans(inner);
		var primaryIndex = spans.indexOf(primarySpan);
		var localCandidate = primaryIndex >= 0 ? spans.slice(primaryIndex + 1) : [];
		var candidate = localCandidate.filter(function (span) {
			return !span.hasAttribute(HANGUL_LABEL_ATTR);
		}).pop();

		if (candidate && candidate.className) {
			return candidate.className;
		}

		var layout = keyElement.closest('.Layout_qwerty_int');
		if (!layout) return '';

		var cached = layout.getAttribute('data-steam-korean-altgr-class');
		if (cached) return cached;

		var keys = layout.querySelectorAll('[data-key][data-key-row][data-key-col]');
		for (var index = 0; index < keys.length; index += 1) {
			var otherInner = getInnerLabelContainer(keys[index]);
			var otherSpans = getDirectSpans(otherInner);
			var otherPrimary = Array.prototype.find.call(otherSpans, function (span) {
				return !span.className && !span.hasAttribute(HANGUL_LABEL_ATTR);
			});
			var otherPrimaryIndex = otherSpans.indexOf(otherPrimary);
			var otherCandidate = otherPrimaryIndex >= 0 ? otherSpans.slice(otherPrimaryIndex + 1).filter(function (span) {
				return !span.hasAttribute(HANGUL_LABEL_ATTR);
			}).pop() : null;
			if (otherCandidate && otherCandidate.className) {
				layout.setAttribute('data-steam-korean-altgr-class', otherCandidate.className);
				return otherCandidate.className;
			}
		}

		return '';
	}

	function removeDuplicateHangulLabelsAfter(inner, primarySpan) {
		var spans = getDirectSpans(inner);
		var primaryIndex = spans.indexOf(primarySpan);
		if (primaryIndex < 0) return;

		var keptHangulLabel = false;
		spans.slice(primaryIndex + 1).forEach(function (span) {
			if (span.hasAttribute(HANGUL_LABEL_ATTR)) {
				if (!keptHangulLabel) {
					keptHangulLabel = true;
					return;
				}
				span.remove();
			}
		});
	}

	function getExistingHangulLabel(inner, primarySpan) {
		var spans = getDirectSpans(inner);
		var primaryIndex = spans.indexOf(primarySpan);
		if (primaryIndex < 0) return null;

		return Array.prototype.find.call(spans.slice(primaryIndex + 1), function (span) {
			return span.hasAttribute(HANGUL_LABEL_ATTR);
		}) || null;
	}

	function patchAltGrKey(keyElement) {
		if (!keyElement.closest('.Layout_qwerty_int')) return false;

		var rawKey = keyElement.getAttribute('data-key');
		if (rawKey !== 'AltGr' && rawKey !== HANGUL_TOGGLE_SENTINEL) return false;

		keyElement.setAttribute('data-key', HANGUL_TOGGLE_SENTINEL);
		keyElement.setAttribute('aria-label', '한/영');

		var labelSpan = getPrimaryLabelSpan(keyElement);
		if (labelSpan && labelSpan.textContent !== '한/영') {
			labelSpan.textContent = '한/영';
		}

		return true;
	}

	function patchKey(keyElement) {
		if (patchAltGrKey(keyElement)) return;
		if (!keyElement.closest('.Layout_qwerty') && !keyElement.closest('.Layout_qwerty_int')) return;

		var rawKey = keyElement.getAttribute('data-key');
		if (!rawKey || rawKey.length !== 1) return;

		var key = rawKey.toLowerCase();
		if (!Object.prototype.hasOwnProperty.call(HANGUL_BY_KEY, key)) return;

		restoreLegacyKeycap(keyElement);

		var inner = getInnerLabelContainer(keyElement);
		var labelSpan = getPrimaryLabelSpan(keyElement);
		if (!inner || !labelSpan) return;

		var latin = rawKey;
		var shifted = latin === latin.toUpperCase();
		var hangul = shifted ? SHIFT_HANGUL_BY_KEY[key] || HANGUL_BY_KEY[key] : HANGUL_BY_KEY[key];
		var altGrClassName = getSteamAltGrClassName(keyElement, inner, labelSpan);

		var privateDocument = keyElement.ownerDocument || document;
		removeDuplicateHangulLabelsAfter(inner, labelSpan);

		var expectedClassName = (altGrClassName ? altGrClassName + ' ' : '') + 'steam-korean-keycap__hangul';
		var hangulNode = getExistingHangulLabel(inner, labelSpan);
		if (!hangulNode) {
			hangulNode = privateDocument.createElement('span');
			hangulNode.setAttribute(HANGUL_LABEL_ATTR, '1');
			labelSpan.insertAdjacentElement('afterend', hangulNode);
		}

		if (hangulNode.className !== expectedClassName) {
			hangulNode.className = expectedClassName;
		}
		if (!hangulNode.hasAttribute(HANGUL_LABEL_ATTR)) {
			hangulNode.setAttribute(HANGUL_LABEL_ATTR, '1');
		}
		if (hangulNode.textContent !== hangul) {
			hangulNode.textContent = hangul;
		}

		var ariaLabel = latin + ' ' + hangul;
		if (keyElement.getAttribute('aria-label') !== ariaLabel) {
			keyElement.setAttribute('aria-label', ariaLabel);
		}
	}

	function patchKeyboard(root, privateDocument) {
		if (!root || (root.nodeType !== 1 && root !== privateDocument)) return;

		if (root.matches && root.matches(KEY_SELECTOR)) {
			patchKey(root);
		}

		if (root.querySelectorAll) {
			Array.prototype.forEach.call(root.querySelectorAll(KEY_SELECTOR), patchKey);
		}
	}

	function schedulePatch(state, root) {
		state.pendingRoots.push(root || state.document);
		if (state.scheduled) return;

		state.scheduled = true;
		var requestFrame = state.window.requestAnimationFrame || state.window.setTimeout;
		requestFrame.call(state.window, function () {
			state.scheduled = false;
			ensureStyle(state.document);

			var roots = state.pendingRoots;
			state.pendingRoots = [];
			roots.forEach(function (patchRoot) {
				patchKeyboard(patchRoot, state.document);
			});
		});
	}

	function getPatchRoot(state, node) {
		var element = node && node.nodeType === 3 ? node.parentElement : node;
		if (!element || element === state.document || !element.closest) return element || state.document;
		return element.closest(KEY_SELECTOR) || element.closest('.Layout_qwerty') || element;
	}

	function startObserver(state) {
		if (state.observer || !state.document.documentElement) return;

		var Observer = state.window.MutationObserver || window.MutationObserver;
		if (!Observer) {
			schedulePatch(state, state.document);
			return;
		}

		state.observer = new Observer(function (mutations) {
			mutations.forEach(function (mutation) {
				if (mutation.type === 'childList') {
					Array.prototype.forEach.call(mutation.addedNodes, function (node) {
						if (node.nodeType === 1) schedulePatch(state, node);
					});
					schedulePatch(state, getPatchRoot(state, mutation.target));
				} else if (mutation.type === 'attributes') {
					schedulePatch(state, getPatchRoot(state, mutation.target));
				} else if (mutation.type === 'characterData') {
					schedulePatch(state, getPatchRoot(state, mutation.target));
				}
			});
		});

		state.observer.observe(state.document.documentElement, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
			attributeFilter: ['class', 'data-key', 'data-key-row', 'data-key-col'],
		});
	}

	function install(target) {
		var targetWindow = resolveWindow(target);
		var privateDocument = targetWindow.document;
		if (!privateDocument) return null;

		var state = targetWindow[STATE_KEY];
		if (state && state.installed) {
			schedulePatch(state, privateDocument);
			return state;
		}

		state = {
			document: privateDocument,
			installed: true,
			observer: null,
			pendingRoots: [],
			scheduled: false,
			window: targetWindow,
		};
		targetWindow[STATE_KEY] = state;

		function boot() {
			ensureStyle(privateDocument);
			startObserver(state);
			schedulePatch(state, privateDocument);
		}

		if (privateDocument.readyState === 'loading') {
			privateDocument.addEventListener('DOMContentLoaded', boot, { once: true });
		} else {
			boot();
		}

		return state;
	}

	function uninstall(target) {
		var targetWindow = resolveWindow(target);
		var state = targetWindow[STATE_KEY];
		if (!state) return;

		if (state.observer) state.observer.disconnect();
		var style = state.document && state.document.getElementById(STYLE_ID);
		if (style) style.remove();
		targetWindow[STATE_KEY] = null;
	}

	window[API_KEY] = {
		install: install,
		uninstall: uninstall,
	};

	install(window);
})();
