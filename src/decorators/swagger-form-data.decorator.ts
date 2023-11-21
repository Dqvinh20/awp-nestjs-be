import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import {
	ReferenceObject,
	SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export function ApiDocsPagination() {
	return applyDecorators(
		ApiQuery({
			required: false,
			name: 'select',
			description: `Select fields. http://mongoosejs.com/docs/api.html#query_Query-select`,
			type: 'string',
			examples: {
				string: {
					value: 'name',
					description: `Select name field`,
				},
			},
		}),
		ApiQuery({
			required: false,
			name: 'page',
			description: `Current page`,
			type: Number,
			examples: {
				'1': {
					value: 1,
					description: 'Page 1',
				},
				'10': {
					value: 10,
					description: `Page 10`,
				},
			},
		}),
		ApiQuery({
			required: false,
			name: 'limit',
			description: `Page size`,
			type: Number,
			examples: {
				'10': {
					value: 10,
					description: `Get 10 entities`,
				},
				'50': {
					value: 50,
					description: `Get 50 entities`,
				},
			},
		}),
		ApiQuery({
			required: false,
			name: 'pagination',
			description: `Toggle pagination`,

			type: Boolean,
			examples: {
				true: {
					value: true,
					description: `Turn on pagination`,
				},
				false: {
					value: false,
					description: `Turn off pagination`,
				},
			},
		}),
		ApiQuery({
			required: false,
			name: 'sort',
			description: `Sort results`,

			type: 'object | string',
			examples: {
				object: {
					value: "{ 'created_at': 'desc' }",
					description: `Sort by object`,
				},
				string: {
					value: 'created_at',
					description: `Sort by string`,
				},
			},
		}),
	);
}

export function ApiBodyWithSingleFile(
	name = 'file',
	body_properties?: object,
	required_properties?: string[],
	local_options?: MulterOptions,
) {
	let properties: Record<string, SchemaObject | ReferenceObject>;
	const api_body = {
		schema: {
			type: 'object',
			properties,
			required: required_properties,
		},
	};
	if (!body_properties) {
		api_body.schema = {
			...api_body.schema,
			properties: {
				[name]: {
					type: 'string',
					format: 'binary',
				},
			},
		};
	} else {
		api_body.schema = {
			...api_body.schema,
			properties: {
				...body_properties,
				[name]: {
					type: 'string',
					format: 'binary',
				},
			},
		};
	}
	return applyDecorators(
		ApiConsumes('multipart/form-data'),
		ApiBody(api_body),
		UseInterceptors(FileInterceptor(name, local_options)),
	);
}
