import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseInterceptors,
	SerializeOptions,
	UseGuards,
	BadRequestException,
	Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './entities/user.entity';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';
import { JwtAccessTokenGuard } from '@modules/auth/guards/jwt-access-token.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { USER_ROLE } from '@modules/user-roles/entities/user-role.entity';
import {
	ApiBearerAuth,
	ApiOkResponse,
	ApiOperation,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { isEmail, isEnum, isMongoId } from 'class-validator';
import { MailerService } from '@nestjs-modules/mailer';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { Public } from 'src/decorators/auth.decorator';
import { UserRolesService } from '@modules/user-roles/user-roles.service';
import { Role } from 'src/decorators/role.decorator';

@ApiBearerAuth()
@Controller('users')
@ApiTags('users')
@ApiUnauthorizedResponse({
	description: 'Unauthorized',
	schema: {
		type: 'object',
		example: {
			statusCode: 401,
			message: 'Unauthorized',
		},
	},
})
@UseGuards(RolesGuard)
@UseGuards(JwtAccessTokenGuard)
@UseInterceptors(MongooseClassSerializerInterceptor(User))
export class UsersController {
	constructor(
		private readonly users_service: UsersService,
		private readonly user_roles_service: UserRolesService,
		private readonly email_service: MailerService,
	) {}

	@ApiOperation({
		summary: 'Admin create new user',
		description: `
* Only admin can use this API

* Admin create user and give some specific information`,
	})
	@Roles(USER_ROLE.ADMIN)
	@Post()
	create(@Body() create_user_dto: CreateUserDto) {
		return this.users_service.create(create_user_dto);
	}

	@SerializeOptions({
		excludePrefixes: ['first', 'last'],
	})
	@Roles(USER_ROLE.ADMIN)
	@Get()
	findAll() {
		return this.users_service.findAll();
	}

	@ApiOperation({
		summary: 'Get current logged user info',
		description: ``,
	})
	@ApiOkResponse({
		description: 'Return current logged user info',
	})
	@UseGuards(JwtAccessTokenGuard)
	@Get('/me')
	async getCurrentUserInfo(@Req() request) {
		const { user } = request;
		return user;
	}

	@Get(':id')
	async findOne(@Param('id') id: string) {
		if (!isMongoId(id)) {
			throw new BadRequestException("Invalid user's id");
		}
		return await this.users_service.findOne(id);
	}

	@ApiOperation({
		summary: 'User update infor',
		description: `
* Student can update student id

* Teacher can't update student id`,
	})
	@Patch(':id')
	async update(
		@Param('id') id: string,
		@Body() update_user_dto: UpdateUserDto,
		@Body('role') role: USER_ROLE,
		@Role() authRole: USER_ROLE,
	) {
		if (!isMongoId(id)) {
			throw new BadRequestException("Invalid user's id");
		}

		// Admin can update user's role
		if (authRole === USER_ROLE.ADMIN && role) {
			if (!isEnum(role, USER_ROLE)) {
				throw new BadRequestException('Invalid role');
			}

			const newRole = await this.user_roles_service.findOneByCondition({
				name: role,
			});
			return this.users_service
				.update(id, {
					...update_user_dto,
					role: newRole,
				})
				.then((user: UserDocument) => user.populate('role'));
		}

		// Teacher can't update any student_id
		if (authRole === USER_ROLE.TEACHER) {
			delete update_user_dto?.student_id;
		}

		if (update_user_dto.student_id && update_user_dto?.student_id === '') {
			throw new BadRequestException('Student id can not be empty');
		}

		return this.users_service
			.update(id, update_user_dto)
			.then((user: UserDocument) => user.populate('role'));
	}

	@ApiOperation({
		summary: 'User update password',
		description: "User can update password with it's current password",
	})
	@Patch(':id/password')
	async updatePassword(
		@Param('id') id: string,
		@Body() update_user_password_dto: UpdateUserPasswordDto,
	) {
		if (!isMongoId(id)) {
			throw new BadRequestException("Invalid user's id");
		}

		return await this.users_service.updatePassword(
			id,
			update_user_password_dto,
		);
	}
	@Delete(':id')
	@Roles(USER_ROLE.ADMIN)
	remove(@Param('id') id: string) {
		if (!isMongoId(id)) {
			throw new BadRequestException("Invalid user's id");
		}
		return this.users_service.remove(id);
	}

	@ApiOperation({
		summary: 'User forgot password',
		description: `Reset password link will send to email`,
	})
	@Public()
	@Get('forgot-password/:email')
	async forgotPassword(@Param('email') email: string) {
		if (!isEmail(email)) {
			throw new BadRequestException('Invalid email');
		}

		const text = await this.users_service.getForgotPasswordMailBody(email);
		return this.email_service
			.sendMail({
				to: email,
				subject: 'Reset password',
				text,
				html: text,
			})
			.then(() => 'Reset password link has been sent to your email')
			.catch(() => "Can't send reset password link to your email");
	}

	@ApiOperation({
		summary: 'User reset password',
		description: `User reset password with token sent to email`,
	})
	@Public()
	@Patch('reset-password/:token')
	async resetPassword(
		@Param('token') token: string,
		@Body() body: ResetUserPasswordDto,
	) {
		const email = await this.users_service.decodePasswordToken(token);
		try {
			await this.users_service.resetPassword(email, body.new_password, token);
		} catch (error) {
			throw new BadRequestException(error.message);
		}

		return 'Reset password successfully';
	}

	@Get(':id/block')
	@Roles(USER_ROLE.ADMIN)
	async blockUser(@Param('id') id: string) {
		if (!isMongoId(id)) {
			throw new BadRequestException("Invalid user's id");
		}
		return await this.users_service
			.blockUser(id)
			.then(() => 'Blocked user successfully');
	}

	@Get(':id/unblock')
	@Roles(USER_ROLE.ADMIN)
	async unblockUser(@Param('id') id: string) {
		if (!isMongoId(id)) {
			throw new BadRequestException("Invalid user's id");
		}
		return await this.users_service
			.unblockUser(id)
			.then(() => 'Unblocked user successfully');
	}
}
