import { cacheExchange, Resolver, Cache } from "@urql/exchange-graphcache";
import { dedupExchange, fetchExchange, Exchange, stringifyVariables, gql } from "urql";
import {
  DeletePostMutationVariables,
  LoginMutation,
  LogoutMutation,
  MeDocument,
  MeQuery,
  RegisterMutation,
  VoteMutationVariables,
} from "../generated/graphql";
import { betterUpdateQuery } from "./betterUpdateQuery";
import { pipe, tap } from "wonka";
import Router from "next/router";
import { isServer } from "./isServer";
//@ts-checkimport { isServer } from "./isServer";

const errorExchange: Exchange = ({ forward }) => (ops$) => {
  return pipe(
    forward(ops$),
    tap(({ error }) => {
      if (error?.message.includes("Not authenticated")) {
        Router.replace("/login");
      }
    })
  );
};

const cursorPagination = (): Resolver => {
  return (_parent, fieldArgs, cache, info) => {
    const { parentKey: entityKey, fieldName } = info;
    const allFields = cache.inspectFields(entityKey);
    const fieldInfos = allFields.filter((info) => info.fieldName === fieldName);
    const size = fieldInfos.length;
    if (size === 0) {
      return undefined;
    }

    const fieldKey = `${fieldName}(${stringifyVariables(fieldArgs)})`;
    const isItInTheCache = cache.resolve(
      cache.resolve(entityKey, fieldKey) as string,
      "posts"
    );
    info.partial = !isItInTheCache;
    let hasMore = true;
    const results: string[] = [];
    fieldInfos.forEach((fi) => {
      const key = cache.resolve(entityKey, fi.fieldKey) as string;
      const data = cache.resolve(key, "posts") as string[];
      const _hasMore = cache.resolve(key, "hasMore");
      if (!_hasMore) {
        hasMore = _hasMore as boolean;
      }
      results.push(...data);
    });

    return {
      __typename: "PaginatedPosts",
      hasMore,
      posts: results,
    };
  };
};




function invalidateALLPosts(cache: Cache) {
  const allFields = cache.inspectFields('Query');
  const fieldInfos = allFields.filter((info) => info.fieldName === 'posts');
  fieldInfos.forEach((fi) => {
    cache.invalidate('Query', 'posts', fi.arguments || {})// invalidate all the paginated items of the query so that it fetches again with the newlly created post
  })
}


export const createUrqlClient = (_ssrExchange: any, ctx: any) => {

  let cookie = ''
  if (isServer()) {
    cookie = ctx?.req?.headers?.cookie
  }

  return {
    url: 'http://localhost:4000/graphql',
    fetchOptions: {
      credentials: "include" as const,
      headers: cookie ? {
        cookie
      } : undefined
    },
    exchanges: [dedupExchange, cacheExchange({
      keys: {
        PaginatedPosts: () => null,
      },
      resolvers: { // vai correr smp que a query dos posts é chamada
        Query: {
          posts: cursorPagination(),
        }
      },
      updates: {
        Mutation: {
          vote: (_result, args, cache, info) => {
            const { postId, value } = args as VoteMutationVariables;
            const data = cache.readFragment(
              gql`
            fragment _ on Post {
              id 
              points
              voteStatus
            }
          `,
              { id: postId }
            )
            if (data) {
              if (data.voteStatus === value) {
                return;
              }
              const newPoints = (data.points) + value
              cache.writeFragment(
                gql`
            fragment __ on Post {
              points
              voteStatus
            }
          `,
                { id: postId, points: newPoints, voteStatus: value }
              )
            }

          },
          createPost: (_result, args, cache, info) => {
            invalidateALLPosts(cache)
          },
          logout: (_result, args, cache, info) => {
            betterUpdateQuery<LogoutMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              () => ({ me: null })

            )
          },
          login: (_result, args, cache, info) => {
            betterUpdateQuery<LoginMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              (result, query) => {
                if (result.login.errors) {
                  return query
                } else {
                  return {
                    me: result.login.user
                  };
                }
              }
            );
            invalidateALLPosts(cache);
          },
          register: (_result, args, cache, info) => {
            betterUpdateQuery<RegisterMutation, MeQuery>(
              cache,
              { query: MeDocument },
              _result,
              (result, query) => {
                if (result.register.errors) {
                  return query
                } else {
                  return {
                    me: result.register.user
                  };
                }
              }
            )
          },
          deletePostById: (_result, args, cache, info) => {
            cache.invalidate({
              __typename: "Post",
              id: (args as DeletePostMutationVariables).id,
            });
          }

        }
      }

    }),
      errorExchange,
      _ssrExchange,
      fetchExchange
    ],
  }
};