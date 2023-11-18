import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import VerificationTokenPayload from './interfaces/verificationTokenPayload.interface';
import { UsersService } from '@modules/users/users.service';

@Injectable()
export class EmailConfirmationService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
		private readonly emailService: MailerService,
		private readonly usersService: UsersService,
	) {}

	sendVerificationLink(email: string) {
		const payload: VerificationTokenPayload = { email };
		const token = this.jwtService.sign(payload, {
			secret: this.configService.get('JWT_VERIFICATION_TOKEN_SECRET'),
			expiresIn: `${this.configService.get(
				'JWT_VERIFICATION_TOKEN_EXPIRATION_TIME',
			)}s`,
		});

		const url = `${this.configService.get(
			'EMAIL_CONFIRMATION_URL',
		)}?token=${token}`;

		const text = `Welcome to the application. To confirm the email address, click here: ${url}. The confirmation link expires in ${
			Number(this.configService.get('JWT_VERIFICATION_TOKEN_EXPIRATION_TIME')) /
			3600
		} hours.`;

		return this.emailService.sendMail({
			to: email,
			subject: 'Email confirmation',
			text,
			html: text,
		});
	}

	async resendConfirmationLink(userId: string) {
		const user = await this.usersService.findOne(userId);
		if (user.isEmailConfirmed) {
			throw new BadRequestException('Email already confirmed');
		}
		await this.sendVerificationLink(user.email);
	}

	async confirmEmail(email: string) {
		const user = await this.usersService.getUserByEmail(email);
		if (user.isEmailConfirmed) {
			throw new BadRequestException('Email already confirmed');
		}
		await this.usersService.markEmailAsConfirmed(email);
	}

	async decodeConfirmationToken(token: string) {
		try {
			const payload = await this.jwtService.verify(token, {
				secret: this.configService.get('JWT_VERIFICATION_TOKEN_SECRET'),
			});

			if (typeof payload === 'object' && 'email' in payload) {
				return payload.email;
			}
			throw new BadRequestException();
		} catch (error) {
			if (error?.name === 'TokenExpiredError') {
				throw new BadRequestException('Email confirmation token expired');
			}
			throw new BadRequestException('Bad confirmation token');
		}
	}
}
