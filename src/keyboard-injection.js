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
	var US_INTL_DEAD_KEY_BY_LABEL = {
		'\' "': '\'',
		'" \'': '\'',
	};

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
			'.steam-korean-keycap__latin{',
			'justify-self:end;',
			'font-size:.82em;',
			'opacity:.76;',
			'}',
			'.steam-korean-keycap__hangul{',
			'justify-self:start;',
			'font-size:.72em;',
			'font-weight:500;',
			'opacity:.62;',
			'}',
		].join('');
		privateDocument.head.appendChild(style);
	}

	function getPrimaryLabelSpan(keyElement) {
		var inner = Array.prototype.find.call(keyElement.children, function (child) {
			return child.tagName === 'DIV';
		});
		if (!inner) return null;

		var spans = Array.prototype.filter.call(inner.children, function (child) {
			return child.tagName === 'SPAN';
		});
		if (!spans.length) return null;

		return spans[spans.length - 1];
	}

	function getLatinLabel(keyElement, labelSpan, key) {
		var injected = labelSpan.firstElementChild;
		if (injected && injected.classList.contains('steam-korean-keycap') && injected.dataset.latin) {
			return injected.dataset.latin;
		}

		var text = (labelSpan.textContent || '').trim();
		if (/^[A-Za-z]$/.test(text)) return text;
		return key;
	}

	function normalizeUsIntlDeadKey(keyElement) {
		if (!keyElement.closest('.Layout_qwerty_int')) return;

		var labelSpan = getPrimaryLabelSpan(keyElement);
		if (!labelSpan) return;

		var label = (labelSpan.textContent || '').trim().replace(/\s+/g, ' ');
		var normalizedKey = US_INTL_DEAD_KEY_BY_LABEL[label];
		if (!normalizedKey) return;

		keyElement.setAttribute('data-key', normalizedKey);
		keyElement.setAttribute('aria-label', label);
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

		normalizeUsIntlDeadKey(keyElement);

		var rawKey = keyElement.getAttribute('data-key');
		if (!rawKey || rawKey.length !== 1) return;

		var key = rawKey.toLowerCase();
		if (!Object.prototype.hasOwnProperty.call(HANGUL_BY_KEY, key)) return;

		var labelSpan = getPrimaryLabelSpan(keyElement);
		if (!labelSpan) return;

		var latin = getLatinLabel(keyElement, labelSpan, rawKey);
		var shifted = latin === latin.toUpperCase();
		var hangul = shifted ? SHIFT_HANGUL_BY_KEY[key] || HANGUL_BY_KEY[key] : HANGUL_BY_KEY[key];
		var existing = labelSpan.firstElementChild;

		if (existing && existing.classList.contains('steam-korean-keycap') && existing.dataset.latin === latin && existing.dataset.hangul === hangul) {
			return;
		}

		var privateDocument = keyElement.ownerDocument || document;
		var wrapper = privateDocument.createElement('span');
		wrapper.className = 'steam-korean-keycap';
		wrapper.dataset.latin = latin;
		wrapper.dataset.hangul = hangul;

		var latinNode = privateDocument.createElement('span');
		latinNode.className = 'steam-korean-keycap__latin';
		latinNode.textContent = latin;

		var hangulNode = privateDocument.createElement('span');
		hangulNode.className = 'steam-korean-keycap__hangul';
		hangulNode.textContent = hangul;

		wrapper.appendChild(latinNode);
		wrapper.appendChild(hangulNode);
		labelSpan.textContent = '';
		labelSpan.appendChild(wrapper);
		keyElement.setAttribute('aria-label', latin + ' ' + hangul);
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
