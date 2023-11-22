import { Controller, Get } from '@nestjs/common';

@Controller('/')
export class AppController {
	@Get('/')
	async checkLive() {
		return `<html>
		<body>
		Live and kicking! Swagger docs available at <a href = "/api-docs" > /api-docs</a>
		</body>
		</html>`;
	}
}
