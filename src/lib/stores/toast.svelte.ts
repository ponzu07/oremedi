let message = $state('');
let visible = $state(false);
let timer: ReturnType<typeof setTimeout> | null = null;

export const toast = {
	get message() { return message; },
	get visible() { return visible; },
	show(msg: string, duration = 2000) {
		message = msg;
		visible = true;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			visible = false;
			timer = null;
		}, duration);
	}
};
