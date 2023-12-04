import {
	Logger,
	UsePipes,
	ValidationError,
	ValidationPipe,
} from '@nestjs/common';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
	WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

@UsePipes(
	new ValidationPipe({
		exceptionFactory(validationErrors: ValidationError[] = []) {
			const errors = this.flattenValidationErrors(validationErrors);
			return new WsException(errors);
		},
	}),
)
@WebSocketGateway({
	cors: {
		origin: true,
		credentials: true,
	},
})
export class NotificationsGateway implements OnGatewayConnection {
	@WebSocketServer()
	private readonly server: Server;
	logger = new Logger(NotificationsGateway.name);

	constructor(
		private readonly notifications_service: NotificationsService,
		private readonly event_emitter: EventEmitter2,
	) {}

	async handleConnection(socket: Socket) {
		await this.notifications_service.authenSocketUser(socket);
	}

	@SubscribeMessage('room')
	async joinRoom(
		@ConnectedSocket() socket: Socket,
		@MessageBody() roomId: string,
	) {
		await socket.join(roomId);
		return `User ${socket.id} joined room ${roomId}`;
	}

	// @OnEvent(NotificationEvents.ON_NEW_NOTIFICATION)
	async handleCreateNotifications(data: CreateNotificationDto) {
		const newNotif = await this.notifications_service.create(data);
		// this.broadcast({
		// 	room: newNotif.to.toString(),
		// 	event: NotificationEvents.ON_NEW_NOTIFICATION,
		// 	data: newNotif,
		// });
	}

	broadcast({
		room,
		event,
		data,
	}: {
		room: string | string[];
		event: string;
		data: any;
	}) {
		if (room) {
			return this.server.to(room).emit(event, data);
		}

		return this.server.emit(event, data);
	}
}
