import { Module } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { ClassesRepository } from '@repositories/classes.repository';
import { Class, ClassSchema } from './entities/class.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { intersectionWith } from 'lodash';
import { Error } from 'mongoose';

@Module({
	imports: [
		MongooseModule.forFeatureAsync([
			{
				name: Class.name,
				useFactory: () => {
					const schema = ClassSchema;

					schema.pre('save', function (next) {
						const results = intersectionWith(
							this.teachers,
							this.students,
							(a, b) => {
								return a.toString() === b.toString();
							},
						);
						if (results.length === 0) next();

						next(new Error.ValidationError());
					});

					return schema;
				},
			},
		]),
	],
	controllers: [ClassesController],
	providers: [
		ClassesService,
		{ provide: 'ClassesRepositoryInterface', useClass: ClassesRepository },
	],
	exports: [ClassesService],
})
export class ClassesModule {}
