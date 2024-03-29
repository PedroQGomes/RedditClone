import { isAuth } from "../middleware/isAuth";
import { MyContext } from "src/types";
import { Query, Resolver, Arg, Mutation, InputType, Ctx, Field, UseMiddleware, Int, FieldResolver, Root, ObjectType } from "type-graphql";
import { Post } from "../entities/Post"
import { getConnection } from "typeorm";
import { Updoot } from "../entities/Updoot";


@InputType()
class PostInput {
    @Field()
    title: string;
    @Field()
    text: string;
}

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[];

    @Field()
    hasMore: boolean;
}


@Resolver(Post)
export class PostResolver {

    @FieldResolver(() => String)
    textSnippet(@Root() post: Post) {
        return post.text.slice(0, 50); // return the first 50 characters of the text
    }

    @FieldResolver(() => Int, { nullable: true })
    async voteStatus(
        @Root() post: Post,
        @Ctx() { updootLoader, req }: MyContext
    ) {
        if (!req.session.userId) {
            return null;
        }
        const updoot = await updootLoader.load({
            postId: post.id,
            userId: req.session.userId,
        });
        return updoot ? updoot.value : null;
    }


    @Query(() => PaginatedPosts) // tipo de output que a query retorna
    async posts(@Arg('limit', () => Int) limit: number, @Arg('cursor', () => String, { nullable: true }) cursor: string | null): Promise<PaginatedPosts> // Contexto para ter acesso ao type orm e dps é type checking da query pelo Ts
    {

        const realLimit = Math.min(50, limit);
        const realLimitPlusOne = realLimit + 1; // limit + 1 para saber se tem mais posts
        const qb = getConnection()
            .getRepository(Post)
            .createQueryBuilder("p")
            .innerJoinAndSelect("p.creator", "u", "u.id = p.creatorId")
            .orderBy('p.createdAt', 'DESC')
            .take(realLimitPlusOne)

        if (cursor) {
            qb.where('p.createdAt < :cursor', { cursor: new Date(parseInt(cursor)) });
        }

        const posts = await qb.getMany();

        return { posts: posts.slice(0, realLimit), hasMore: posts.length === realLimitPlusOne };
    }

    // Query para aceder a um post com um dado id
    @Query(() => Post, { nullable: true })
    post(
        @Arg('id', () => Int) id: number,
    ): Promise<Post | undefined> {
        return Post.findOne(id, { relations: ["creator"] });
    }

    // Criaçao de um novo Post
    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg('input') input: PostInput, @Ctx() { req }: MyContext): Promise<Post> {
        return Post.create({ ...input, creatorId: req.session.userId }).save();
    }


    // Alteraçao de um Post dado um id.
    @Mutation(() => Post, { nullable: true })
    @UseMiddleware(isAuth)
    async updatePost(
        @Arg('id', () => Int) id: number,
        @Arg('title') title: string, // Arg(key) value
        @Arg('text') text: string, // Arg(key) value
        @Ctx() { req }: MyContext
    ): Promise<Post | null> {

        const result = await getConnection()
            .createQueryBuilder()
            .update(Post)
            .set({ title, text })
            .where('id = :id and "creatorId" = :creatorId', { id, creatorId: req.session.userId })
            .returning("*")
            .execute()

        return result.raw[0]
        //return Post.update({ id, creatorId: req.session.userId }, { title, text });
    }

    // Eliminar um Post pelo id.
    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async deletePostById(
        @Arg('id', () => Int) id: number,
        @Ctx() { req }: MyContext
    ): Promise<boolean> {

        await Post.delete({ id, creatorId: req.session.userId });
        return true;
    }


    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg('postId', () => Int) postId: number,
        @Arg('value', () => Int) value: number,
        @Ctx() { req }: MyContext
    ): Promise<boolean> {

        const isUpdoot = value !== -1;
        const realValue = isUpdoot ? 1 : -1;
        const { userId } = req.session;

        const updoot = await Updoot.findOne({ where: { postId, userId } })

        if (updoot && updoot.value !== realValue) {
            await getConnection().transaction(async tm => {
                await tm.query(`
                update updoot 
                set value = $1
                where "postId" = $2 and "userId" = $3;
                `, [realValue, postId, userId])

                await tm.query(`
                update post
                set points = points + $1
                where id = $2;
                `, [realValue, postId])
            })

        } else if (!updoot) {
            await getConnection().transaction(async tm => {
                await tm.query(`
                insert into updoot ("userId","postId",value)
                values ($1,$2,$3);
                `, [userId, postId, realValue])

                await tm.query(`
                update post
                set points = points + $1
                where id = $2;
                `, [realValue, postId])
            })
        }
        return true;
    }


}