import { Transform } from 'class-transformer';

/**
 * Decorator to parse string to boolean
 * @returns {Boolean} To Boolean
 */
export function ToBoolean(): (target: any, key: string) => void {
	return Transform(({ value }) => {
		return value === 'true' || value === true || value === 1 || value === '1';
	});
}

/**
 * Convert string to object or string
 * @returns {String|Object} To Object or String
 */
export function ToObjectOrString(): (target: any, key: string) => void {
	return Transform(({ value }): object | string => {
		try {
			return JSON.parse(value);
		} catch (error) {
			return value.toString();
		}
	});
}
