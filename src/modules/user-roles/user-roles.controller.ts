import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	Delete,
	UseInterceptors,
	UseGuards,
} from '@nestjs/common';
import { UserRolesService } from './user-roles.service';
import { CreateUserRoleDto } from './dto/create-user-role.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import MongooseClassSerializerInterceptor from 'src/interceptors/mongoose-class-serializer.interceptor';
import { USER_ROLE, UserRole } from './entities/user-role.entity';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/guards/roles.guard';
import { JwtAccessTokenGuard } from '@modules/auth/guards/jwt-access-token.guard';

@Controller('user-roles')
@ApiTags('user-roles')
@ApiBearerAuth()
@Roles(USER_ROLE.ADMIN)
@UseGuards(RolesGuard)
@UseGuards(JwtAccessTokenGuard)
@UseInterceptors(MongooseClassSerializerInterceptor(UserRole))
export class UserRolesController {
	constructor(private readonly user_roles_service: UserRolesService) {}

	@Post()
	create(@Body() create_user_role_dto: CreateUserRoleDto) {
		return this.user_roles_service.create(create_user_role_dto);
	}

	@Get()
	findAll() {
		return this.user_roles_service.findAll();
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.user_roles_service.findOne(id);
	}

	@Patch(':id')
	update(
		@Param('id') id: string,
		@Body() update_user_role_dto: UpdateUserRoleDto,
	) {
		return this.user_roles_service.update(id, update_user_role_dto);
	}

	@Delete(':id')
	remove(@Param('id') id: string) {
		return this.user_roles_service.remove(id);
	}
}
