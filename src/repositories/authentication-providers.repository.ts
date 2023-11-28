import {
	AuthenticationProvider,
	AuthenticationProviderDocument,
} from '@modules/authentication_providers/entity/authentication_provider.entity';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepositoryAbstract } from './base/base.abstract.repository';
import { AuthenticationProvidersRepositoryInterface } from '@modules/authentication_providers/interfaces/authentication_providers.interface';

@Injectable()
export class AuthenticationProvidersRepository
	extends BaseRepositoryAbstract<AuthenticationProviderDocument>
	implements AuthenticationProvidersRepositoryInterface
{
	constructor(
		@InjectModel(AuthenticationProvider.name)
		private readonly auth_provider_model: Model<AuthenticationProviderDocument>,
	) {
		super(auth_provider_model);
	}
}
