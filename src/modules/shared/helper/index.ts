import { User } from '@modules/users/entities/user.entity';

export const getUserFullNameOrEmail = (user: User) => {
	if (!user) return '';

	const { first_name, last_name, email } = user;

	if (first_name && last_name) {
		return `${first_name} ${last_name}`;
	}

	if (first_name && !last_name) {
		return first_name;
	}

	if (!first_name && last_name) {
		return last_name;
	}

	return email;
};
