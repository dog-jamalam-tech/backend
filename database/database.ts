import { Bson, MongoClient } from "https://deno.land/x/mongo@v0.28.1/mod.ts";
import { getRandomImage } from "../dogApi/dogApi.ts";
import { migrate } from "./migration.ts";
import Snowflake from "https://deno.land/x/snowflake@v1/mod.ts";

const client = new MongoClient();
const snowflake: Snowflake = new Snowflake();

await client.connect("mongodb://127.0.0.1:27017");

interface Post {
  _id: Bson.ObjectId;
  votes: number;
  imageUrl: string;
  index: number;
}

export interface User {
  _id: Bson.ObjectId;
  snowflake: string;
  votedOn: number[];
  index: number;
  loginCode: string;
}

const db = client.database("dog_image_website_db");
const posts = db.collection<Post>("posts");
const users = db.collection<User>("users");

export const getRandomLoginCode = (): string => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += characters[Math.floor(Math.random() * characters.length)];
  }
  return code;
};

const appendTillIndex = (
  index: number,
  value: number,
  arr: number[],
): number[] => {
  if (arr.length < index) {
    let currentIndex = 0;

    while (currentIndex < index) {
      if (arr[currentIndex] == null) {
        arr.push(0);
      }
      currentIndex++;
    }

    arr.push(value);
  } else {
    arr[index] = value;
  }

  return arr;
};

export const createUser = async (): Promise<User> => {
  const user = await users.insertOne({
    snowflake: snowflake.toBase64(await snowflake.generate()),
    votedOn: [],
    index: 0,
    loginCode: getRandomLoginCode(),
  });

  return (await users.findOne({ _id: user })) as User;
};

export const getOrCreatePost = async (
  index: number,
): Promise<Post | undefined> => {
  let post = await posts.findOne({ index: index });

  if (!post) {
    let imageUrl = await getRandomImage();
    let foundPost = await posts.findOne({ imageUrl: imageUrl });

    while (foundPost) {
      imageUrl = await getRandomImage();
      foundPost = await posts.findOne({ imageUrl: imageUrl });
    }

    const id = await posts.insertOne({
      votes: 0,
      imageUrl: imageUrl,
      index: index,
    });

    post = await posts.findOne({ _id: id });
  }

  return post;
};

export const getUser = async (
  userSnowflake: string,
): Promise<User | undefined> => {
  return await users.findOne({ snowflake: userSnowflake });
};

export const getUserByLoginCode = async (
  loginCode: string,
): Promise<User | undefined> => {
  return await users.findOne({ loginCode: loginCode });
};

export const updateUser = async (
  updatedUser: User,
): Promise<User> => {
  const user = await users.replaceOne({ _id: updatedUser._id }, updatedUser);
  return await users.findOne({ _id: user }) as User;
};

export const setVoteForUser = async (
  user: User,
  postIndex: number,
  voteValue: number,
) => {
  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        votedOn: appendTillIndex(postIndex, voteValue, user.votedOn),
      },
    },
  );
};

export const setVoteForPost = async (
  index: number,
  extra: number,
): Promise<Post | undefined> => {
  const post = await getOrCreatePost(index);

  if (post) {
    await posts.updateOne({ _id: post._id }, { $inc: { votes: extra } });
  }

  return await getOrCreatePost(index);
};

export default { db, posts, users };
migrate();
