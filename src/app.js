const { App } = require("@slack/bolt");
const {
  respondToSslCheck,
} = require("@slack/bolt/dist/receivers/ExpressReceiver");
const { Configuration, OpenAIApi } = require("openai");
const express = require("express");
const serverless = require("serverless-http");
require("dotenv").config();

const netlify_app = express();
const router = express.Router();

// Configuration for Open AI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_TOKEN,
});

const openai = new OpenAIApi(configuration);

router.get("/", (req, res) => {
  //Slack App Configuration
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    port: process.env.PORT || 3000,
  });

  //OpenAI Function to generate blog article from prompt in Slack block format
  async function generateResponse(prompt) {
    const response = await openai.createCompletion({
      model: "text-ada-001",
      prompt: `${prompt}`,
      temperature: 0.9,
      max_tokens: 900,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: ["/n"],
    });
    return response.data.choices[0].text;
  }

  //Slack Slash Command Handler
  app.command("/tilt-chat", async ({ command, ack, client }) => {
    // Acknowledge command request
    await ack();

    //Respond with message to user
    const article_message = await client.chat.postMessage({
      text: `:hourglass: *Generating you a response* - [Your Input: ${command.text}]`,
      channel: command.channel_id,
    });

    //Generate response
    const article = await generateResponse(command.text);

    //Get message timestamp from response
    const messageTimestamp = article_message.ts;
    //Update Message with Article
    await client.chat.update({
      channel: command.channel_id,
      ts: messageTimestamp,
      text: `*Response* :white_check_mark: [Your Input: ${command.text}]:${article}`,
    });
  });

  (async () => {
    // Start your app
    await app.start();

    console.log("⚡️ Bolt app is running!");
  })();
});

netlify_app.use("/.netlify/functions/app", router);

module.exports.handler = serverless(netlify_app);
