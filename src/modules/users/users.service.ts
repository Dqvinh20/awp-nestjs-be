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
	): Promise<{ count: number; emails: string[] }> {
		const dbRole = await this.user_roles_service.findOneByCondition({
			name: role,
		});

		const { count, items } = await this.users_repository.findAll(
			{
				$or: [
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
				],
				role: dbRole,
			},
			{
				projection: { _id: 0, email: 1, role: 0 },
				populate: 'role',
			},
		);

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
}
