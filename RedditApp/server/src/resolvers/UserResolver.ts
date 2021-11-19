import { Ctx, Resolver,Arg, Mutation, Field, ObjectType, Query } from "type-graphql";
import { MyContext } from "src/types";
import { User } from "../entities/User";
import argon2 from 'argon2';
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constant";
import { UsernamePasswordInput } from "../utils/UsernamePasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

@ObjectType()
class FieldError {

    @Field()
    field:string;

    @Field()
    message:string;
}

@ObjectType()
class UserResponse{
    @Field(() => [FieldError],{ nullable:true })
    errors?: FieldError[]

    @Field(()=> User,{ nullable:true })
    user?:User
}



@Resolver()
export class UserResolver{//

    @Mutation(()=>Boolean) 
    async forgotPassword(@Arg("email") email:string,@Ctx() { em,redis }:MyContext){
        const user = await em.findOne(User,{email});
        if(!user){
            // the email is not in the db
            return true;
        }

        // send email to user with the token
        const token =  v4();

        await redis.set(FORGOT_PASSWORD_PREFIX + token,user.id, "ex",1000*60*60*24*3);//3 days

        sendEmail(email,`<a href="http://localhost:3000/user/change-password/${token}">reset password</a>`);
        return true;
    }




    @Mutation(() => UserResponse) 
    async register(@Ctx() {em,req}: MyContext, @Arg('options') options : UsernamePasswordInput): Promise<UserResponse>
    {
        const errors = validateRegister(options);

        if(errors){
            return {errors};
        }

        const passwordHashed = await argon2.hash(options.password);
        const user = em.create(User,{username:options.username,email:options.email,password:passwordHashed});
        
        try{
            await em.persistAndFlush(user);
        }catch(err){
            if(err.code === '23505' || err.detail.includes("already exists")){
                return {
                    errors:[{field:"username",message:"username already taken"}]
                }
            }
        }

        req.session.userId = user.id;

        return {user};

    }


    @Mutation(() => UserResponse) 
    async login(@Ctx() {em,req}: MyContext, @Arg('usernameOrEmail') usernameOrEmail : string,@Arg("password") password :string): Promise<UserResponse>
    {
        const user = await em.findOne(User, usernameOrEmail.includes("@") ? {email:usernameOrEmail}: {username:usernameOrEmail});
        
        if(!user){
            return{
                errors:[
                    {
                        field: "usernameOrEmail",
                        message: "Username doesnt exist",
                    },
                ]
            }
        }
        const valid = await argon2.verify(user.password,password);
        if(!valid){
            return{
                errors:[
                    {
                        field: "password",
                        message: "Incorrect Password",
                    },
                ]
            }
        }

        req.session.userId = user.id;
        return {
            user,
        }

    }

    @Query(() => User, {nullable:true})
    async me(@Ctx() {req,em}: MyContext){
        if(!req.session.userId){
            return null;
        }

        
        var user = em.findOne(User,{id:req.session.userId});
        return user;
    }


    @Mutation(() => Boolean, {nullable:true})
    async logout(@Ctx() {req,res}: MyContext){
        return new Promise(resolve => req.session.destroy(
            (err) =>{
                res.clearCookie(COOKIE_NAME);
                if(err){
                    console.log(err);
                    resolve(false)
                    return;
                }
                resolve(true)
            }
        ))
    }

}