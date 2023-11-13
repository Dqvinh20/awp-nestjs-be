async function postData(url, data = {}) {
	const response = await fetch(url, {
		method: 'POST',
		mode: 'cors',
		cache: 'no-cache',
		credentials: 'same-origin',
		headers: { 'Content-Type': 'application/json' },
		redirect: 'follow',
		referrerPolicy: 'no-referrer',
		body: JSON.stringify(data),
	});
	if (response.status >= 400) {
		throw new Error('invalid credentials');
	}
	return response.json();
}

const AUTH_CREDENTIALS = {
	email: 'michaelsmith@example.com',
	password: '1232@asdS',
};

postData('/api/auth/sign-in', AUTH_CREDENTIALS)
	.then((data) => {
		window.ui.preauthorizeApiKey('bearer', data.access_token);
		console.log('preauth success');
	})
	.catch((e) => {
		console.error(`preauth failed: ${e}`);
	});
