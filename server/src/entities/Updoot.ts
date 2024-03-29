import { Field, ObjectType } from "type-graphql";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./User";
import { Post } from "./Post";

@Entity()
@ObjectType()
export class Updoot extends BaseEntity {


    @Field()
    @Column({ type: "int" })
    value: number


    @Field()
    @PrimaryColumn()
    userId!: number;

    @Field(() => User)
    @ManyToOne(() => User, user => user.updoots, {
        onDelete: "CASCADE"
    })
    user: User;

    @Field()
    @PrimaryColumn()
    postId!: number;

    @Field(() => Post)
    @ManyToOne(() => Post, post => post.updoots)
    post!: Post;

}