import { CreateNotificationDto } from '@modules/notifications/dto/create-notification.dto';

export class FinishGradeEvent extends CreateNotificationDto {
	constructor(dto: CreateNotificationDto) {
		super();
		this.title = dto.title;
		this.message = dto.message;
		this.class = dto.class;
		this.receivers = dto.receivers;
		this.ref_url = dto.ref_url;
		this.sender = dto.sender;
	}
}
