import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { BaseServiceAbstract } from 'src/services/base/base.abstract.service';
import { User } from './entities/user.entity';
import { UsersRepositoryInterface } from './interfaces/users.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRolesService } from '@modules/user-roles/user-roles.service';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import { FindAllResponse } from 'src/types/common.type';
import { ResetPasswordTokenPayload } from './interfaces/resetPasswordTokenPayload.interface';
import { JwtService } from '@nestjs/jwt';
import { resetPasswordConfig } from '@configs/configuration.config';
import {
	comparePassword,
	hashPassword,
} from '@modules/shared/helper/password.helper';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { FilterQuery } from 'mongoose';
import readXlsxFile, { Email } from 'read-excel-file/node';
import { keyBy, pickBy } from 'lodash';

@Injectable()
export class UsersService extends BaseServiceAbstract<User> {
	private readonly config = resetPasswordConfig();

	constructor(
		@Inject('UsersRepositoryInterface')
		private readonly users_repository: UsersRepositoryInterface,
		private readonly user_roles_service: UserRolesService,
		private readonly jwt_service: JwtService,
	) {
		super(users_repository);
	}

	async create(create_dto: CreateUserDto): Promise<User> {
		let user_role = await this.user_roles_service.findOneByCondition({
			name: create_dto.role ?? USER_ROLE.STUDENT,
		});
		if (!user_role) {
			user_role = await this.user_roles_service.create({
				name: create_dto.role ?? USER_ROLE.STUDENT,
			});
		}
		const user = await this.users_repository.create({
			...create_dto,
			role: user_role,
		});
		return user;
	}

	async findAll(
		filter?: object,
		options?: object,
	): Promise<FindAllResponse<User>> {
		return await this.users_repository.findAllWithSubFields(filter, {
			...options,
			populate: 'role',
		});
	}

	async findAllEmails(
		email = '',
		role: USER_ROLE.TEACHER | USER_ROLE.STUDENT = USER_ROLE.STUDENT,
	) {
		const dbRole = await this.user_roles_service.findOneByCondition({
			name: role,
		});

		const query: FilterQuery<User> = {
			role: dbRole,
		};
		if (email.length !== 0) {
			query.$or = [
				{
					$text: {
						$search: email,
					},
				},
				{
					email: {
						$regex: new RegExp(email, 'i'),
					},
				},
			];
		}

		return await this.users_repository.findAll(query, {
			projection: { _id: 1, email: 1, role: 0 },
			populate: 'role',
		});
	}

	async findAllEmailsByRole(
		email = '',
		role: USER_ROLE.TEACHER | USER_ROLE.STUDENT = USER_ROLE.STUDENT,
	): Promise<{ count: number; emails: string[] }> {
		const dbRole = await this.user_roles_service.findOneByCondition({
			name: role,
		});

		const query: FilterQuery<User> = {
			role: dbRole,
		};
		if (email.length !== 0) {
			query.$or = [
				{
					$text: {
						$search: email,
					},
				},
				{
					email: {
						$regex: new RegExp(email, 'i'),
					},
				},
			];
		}

		const { count, items } = await this.users_repository.findAll(query, {
			projection: { _id: 0, email: 1, role: 0 },
			populate: 'role',
		});

		return {
			count,
			emails: items.flatMap((item) => item.email),
		};
	}

	async getUserByEmail(email: string): Promise<User> {
		try {
			const user = await this.users_repository.findOneByCondition({ email });
			if (!user) {
				throw new NotFoundException('User not found');
			}
			return user;
		} catch (error) {
			throw error;
		}
	}

	async getUserWithRole(user_id: string): Promise<User> {
		try {
			return await this.users_repository.getUserWithRole(user_id);
		} catch (error) {
			throw error;
		}
	}

	async setCurrentRefreshToken(
		id: string,
		hashed_token: string,
	): Promise<void> {
		try {
			await this.users_repository.update(id, {
				current_refresh_token: hashed_token,
			});
		} catch (error) {
			throw error;
		}
	}

	async markEmailAsConfirmed(email: string) {
		const user = await this.getUserByEmail(email);
		return this.users_repository.update(user.id, {
			isEmailConfirmed: true,
		});
	}

	async updatePassword(
		id: string,
		update_user_password_dto: UpdateUserPasswordDto,
	) {
		const user = await this.findOne(id);
		if (!user) {
			throw new NotFoundException();
		}

		const isPasswordValid = comparePassword(
			update_user_password_dto.old_password,
			user.password,
		);
		if (!isPasswordValid) {
			throw new BadRequestException('Old password is not correct');
		}

		const hashedNewPassword = hashPassword(
			update_user_password_dto.new_password,
		);

		return await this.update(id, {
			password: hashedNewPassword,
		});
	}

	async getForgotPasswordMailBody(email: string) {
		const user = await this.getUserByEmail(email);

		const payload: ResetPasswordTokenPayload = { email };
		const token = this.jwt_service.sign(payload, {
			secret: this.config.secret,
			expiresIn: `${this.config.expiresIn}s`,
		});

		await this.update(user.id, {
			current_reset_password_token: token,
		});

		const url = `${this.config.url}?token=${token}`;

		const text = `To reset password, click here: ${url}. The reset password link expires in ${
			Number(this.config.expiresIn) / 3600
		} hours.`;

		return text;
	}

	async decodePasswordToken(token: string) {
		try {
			const payload = await this.jwt_service.verify<ResetPasswordTokenPayload>(
				token,
				{
					secret: this.config.secret,
				},
			);

			if (typeof payload === 'object' && 'email' in payload) {
				return payload.email;
			}
			throw new BadRequestException();
		} catch (error) {
			if (error?.name === 'TokenExpiredError') {
				throw new BadRequestException('Reset password token expired');
			}
			throw new BadRequestException('Bad reset password token');
		}
	}

	async resetPassword(
		email: string,
		new_password: string,
		resetPasswordToken: string,
	) {
		const user = await this.getUserByEmail(email);
		if (resetPasswordToken !== user.current_reset_password_token) {
			throw new BadRequestException('Reset password token is not valid');
		}

		const hashedNewPassword = hashPassword(new_password);

		return this.update(user.id, {
			password: hashedNewPassword,
			current_reset_password_token: null,
		});
	}

	async blockUser(id: string) {
		const user = await this.users_repository.findOneById(id);
		if (!user) {
			throw new NotFoundException();
		}

		if (!user.isActive) {
			throw new ForbiddenException('User is already blocked');
		}

		return this.update(id, {
			isActive: false,
		});
	}

	async unblockUser(id: string) {
		const user = await this.users_repository.findOneById(id);
		if (!user) {
			throw new NotFoundException();
		}

		if (user.isActive) {
			throw new ForbiddenException('User is already unblocked');
		}

		return this.update(id, {
			isActive: true,
		});
	}

	permanentlyDelete(id: string) {
		return this.users_repository.permanentlyDelete(id);
	}

	async importMapStudentId(buffer: Buffer) {
		const rows = await readXlsxFile<{
			student_id: string;
			email: string;
		}>(buffer, {
			schema: {
				Email: {
					prop: 'email',
					type: Email,
					required: true,
				},

				'Student ID': {
					prop: 'student_id',
					type: String,
					required: true,
					validate(value: string) {
						if (value.length > 10 || value.length < 0) {
							throw new Error('Student ID must be between 0 and 10 characters');
						}
					},
				},
			},
			transformData(dataExcel: any[]) {
				return dataExcel.filter(
					(rowExcel: any[]) =>
						rowExcel.filter((columnExcel) => columnExcel !== null).length > 0,
				);
			},
		}).then(({ rows, errors }) => {
			let duplicateStudentId = rows.reduce((a: any, e: any) => {
				a[e.student_id] = ++a[e.student_id] || 0;
				return a;
			}, {});
			duplicateStudentId = pickBy(
				duplicateStudentId,
				(value, key) => value >= 1,
			);
			const duplicateStudentIdKeys = Object.keys(duplicateStudentId);
			if (duplicateStudentIdKeys.length !== 0) {
				throw new Error(
					`Duplicate Student ID: <strong class="text-red-500">${duplicateStudentIdKeys.join(
						', ',
					)}</strong>. Please check again!`,
				);
			}

			let duplicateEmails = rows.reduce((a: any, e: any) => {
				a[e.email] = ++a[e.email] || 0;
				return a;
			}, {});
			duplicateEmails = pickBy(duplicateEmails, (value, key) => value >= 1);
			const duplicateEmailKeys = Object.keys(duplicateEmails);
			if (duplicateEmailKeys.length !== 0) {
				throw new Error(
					`Duplicate Email: <strong class="text-red-500">${duplicateEmailKeys.join(
						', ',
					)}</strong>. Please check again!`,
				);
			}

			const errorsKeys = keyBy(errors, 'error');
			if (errors.length === 0) {
				if (rows.length === 0) {
					throw new BadRequestException('Empty file!');
				}
				return rows;
			}

			const details = () => {
				if (errorsKeys['Student ID must be between 0 and 10 characters']) {
					return 'Student ID must be between 0 and 10 characters';
				}

				if (errorsKeys.required) {
					return `Field is missing at row ${errorsKeys.required.row} in column '${errorsKeys.required.column}'`;
				}

				if (errorsKeys.invalid) {
					return `Field is ${errorsKeys.invalid.reason
						?.split('_')
						.join(' ')} at row ${errorsKeys.invalid.row} in column '${
						errorsKeys.invalid.column
					}'`;
				}
			};

			throw new BadRequestException(details());
		});

		const users = await this.users_repository.findAll({
			email: {
				$in: rows.map((row) => row.email),
			},
			role: await this.user_roles_service
				.findOneByCondition({
					name: USER_ROLE.STUDENT,
				})
				.then((role) => role.id),
		});

		await Promise.allSettled(
			users.items.map((user) =>
				this.users_repository.update(user.id, {
					student_id: rows.find((row) => row.email === user.email)?.student_id,
				}),
			),
		);

		return true;
	}
}
