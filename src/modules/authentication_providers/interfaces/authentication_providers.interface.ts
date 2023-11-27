import { AuthenticationProvider } from '@modules/authentication_providers/entity/authentication_provider.entity';
import { BaseRepositoryInterface } from '@repositories/base/base.interface.repository';

export type AuthenticationProvidersRepositoryInterface =
	BaseRepositoryInterface<AuthenticationProvider>;
