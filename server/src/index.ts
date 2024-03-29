import "reflect-metadata"
import { COOKIE_NAME, __prod__ } from "./constant";
import express from 'express'
import { ApolloServer } from "apollo-server-express"
import { buildSchema } from "type-graphql";
import { PostResolver } from "./resolvers/PostResolver";
import { UserResolver } from './resolvers/UserResolver';
import Redis from 'ioredis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import cors from 'cors'
import { createConnection } from 'typeorm';
import { Post } from './entities/Post';
import { User } from './entities/User';
import { Updoot } from './entities/Updoot';
import path from 'path';
import { createUpdootLoader } from "./utils/createUpdootLoader";


const main = async () => {

    console.log("postgres2");
    const conn = await createConnection({
        type: "postgres",
        database: "lireddit2",
        username: "postgres",
        password: "postgres",
        logging: true,
        synchronize: true,
        migrations: [path.join(__dirname, './migrations/*')],
        entities: [Post, User, Updoot]
    });

    await conn.runMigrations();

    // await Post.delete({});

    const app = express();


    const RedisStore = connectRedis(session)
    const redis = new Redis();

    app.use(cors({
        origin: "http://localhost:3000",
        credentials: true
    }));


    app.use(
        session({
            name: COOKIE_NAME,
            store: new RedisStore({ client: redis, disableTouch: true }),
            cookie: {
                maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
                httpOnly: true,
                sameSite: 'lax',    //csrf
                secure: __prod__
            },
            saveUninitialized: false,
            secret: 'asjdnasjdasjdnajsnd',
            resave: false,
        }))

    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [PostResolver, UserResolver],
            validate: false

        }),
        context: ({ req, res }) => ({ req, res, redis, updootLoader: createUpdootLoader(), }), // o contexto serve para por objectos que podem ser acedidos por todos os resolvers do graphql
    });

    await apolloServer.start();


    apolloServer.applyMiddleware({ app, cors: false });


    app.listen(4000, () => {
        console.log("server started at port 4000")
    })

};

main();

