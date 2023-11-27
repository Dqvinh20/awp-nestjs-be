import { Inject, Injectable } from '@nestjs/common';
import { BaseServiceAbstract } from 'src/services/base/base.abstract.service';
import { AuthenticationProvider } from './entity/authentication_provider.entity';
import { AuthenticationProvidersRepositoryInterface } from './interfaces/authentication_providers.interface';

@Injectable()
export class AuthenticationProvidersService extends BaseServiceAbstract<AuthenticationProvider> {
	constructor(
		@Inject('AuthenticationProvidersRepositoryInterface')
		private readonly auth_provider_repository: AuthenticationProvidersRepositoryInterface,
	) {
		super(auth_provider_repository);
	}
}
