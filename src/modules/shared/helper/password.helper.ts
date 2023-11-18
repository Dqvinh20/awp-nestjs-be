import * as bcrypt from 'bcryptjs';

const SALT_ROUND = 11;

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, SALT_ROUND);
}

export function comparePassword(
	password: string,
	hashed_password: string,
): boolean {
	return bcrypt.compareSync(password, hashed_password);
}
