// @ts-nocheck
import { Millennium, IconsModule, definePlugin, Field } from '@steambrew/client';
import '../src/keyboard-injection.js';

const createElement = window.SP_REACT.createElement;

function installKeyboardInjection(target) {
	window.__steamKoreanKeyboardInjection?.install(target);
}

const SettingsContent = () => {
	return createElement(Field, {
		label: 'Korean keyboard injection',
		description: "Adds Korean qwerty labels to Steam's on-screen keyboard.",
		icon: createElement(IconsModule.Settings),
		bottomSeparator: 'standard',
		focusable: true,
	});
};

export default definePlugin(() => {
	installKeyboardInjection(window);
	Millennium.AddWindowCreateHook(installKeyboardInjection);

	return {
		title: 'Steam Korean Keyboard Injection',
		icon: createElement(IconsModule.Settings),
		content: createElement(SettingsContent),
	};
});
