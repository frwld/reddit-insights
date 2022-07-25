/* eslint-disable require-jsdoc */

import log from '../../helpers/log.js';
import {query} from 'express-validator';
import {differenceInHours, differenceInDays} from 'date-fns';
import {Request, Response} from 'express';

import {
  respondWithSuccessAndData,
  respondWithNoContent,
  respondWithError,
} from '../../helpers/response.js';
import {
  getSubmissionsFromRedditUserOnPushshift,
  getCommentsFromRedditUserOnPushshift,
} from '../../sources/reddit/pushshift.js';
import validate from '../../helpers/validate.js';
import redditModel from './redditModel.js';
import {getCountOfSubreddits} from '../../helpers/utils.js'
import {PushshiftRedditPost} from '../../sources/reddit/pushshift.d.js';
import {ToxicityContext} from '../../analytics/ToxicityContext.js';

const VALIDITY_PERIOD_IN_HOURS = 24 * 14;
const VALIDITY_DEBUG = false;

/**
 * Controller class managing incoming requests to the respective model
 * each controller function is actually an array of functions to be plugged into
 * the router with validations by express-validator before as well as
 * the validate helper to check for detected validation errors
 * @param req
 * @param res
 * @param next
 */
export default class RedditController {

  static analyze = [
    query('identifier')
        .exists().withMessage('Value is required')
        .isString().withMessage('Value needs to be string'),
    validate,
    async (req: Request, res: Response) => {
      try {
        const identifier = req.query.identifier as string;
        let redditData = await redditModel.findOne({identifier});
        if (redditData !== null) {
          // Entry exists
          const lastTimeUpdated = new Date(redditData.updatedAt);
          const hoursSinceLastUpdate = differenceInHours(
              Date.now(),
              lastTimeUpdated);
          if (hoursSinceLastUpdate > VALIDITY_PERIOD_IN_HOURS || VALIDITY_DEBUG) {
            // Update entry
            log.info(`ANALYSIS`, `Updating (${identifier})`);
            try {
              const data = await analyze(identifier);
              await redditData.updateOne({identifier}, data);
              respondWithSuccessAndData(
                res,
                await redditData,
                'Updated analysis for an existing Reddit user',
              );
            } catch (error: any) {
              log.error(`ANALYSIS`, error.toString());
              respondWithNoContent(res, 'Analysis APIs overloaded')
            }
          } else {
            // Keep entry
            log.info(`ANALYSIS`, `Keeping (${identifier})`);
            respondWithSuccessAndData(
                res,
                redditData,
                'Kept analysis for an existing Reddit user',
            );
            return;
          }
        } else {
          // Entry does not exist
          log.info(`ANALYSIS`, `Creating (${identifier})`);
          try {
            const data = await analyze(identifier);
            redditData = await redditModel.create(data);
            respondWithSuccessAndData(
              res,
              await redditData,
              'Created analysis for a new Reddit user',
            );
          } catch (error: any) {
            log.error(`ANALYSIS`, error.toString() + ` (${identifier})`);
            respondWithNoContent(res, 'Analysis APIs overloaded')
          }
        }
      } catch (error) {
        log.error('ERROR', 'Error for identifier: ' + req.query.identifier);
        respondWithError(res, `Error for identifier: ${req.query.identifier}`);
        console.log(error);
      }
    },
  ];
  
  static analyzeWithExamples = [
     query('identifier')
        .exists().withMessage('Value is required')
        .isString().withMessage('Value needs to be string'),
    validate,
    async (req: Request, res: Response) => {
      try {
        const identifier = req.query.identifier as string;
        const analysis = await analyzeWithExamples(identifier);
        respondWithSuccessAndData(
          res,
          analysis,
        )
      } catch (error) {
        console.log(error);
        respondWithError(res);
      }
    }
  ];

  static highest = [
    query('behavior')
      .exists().withMessage('Value is required')
      .isString().withMessage('Value needs to be string'),
    validate,
    async(req: Request, res: Response) => {
      try {
        const selectedBehavior = `${req.query.behavior}`
        let highest = {};
        switch(selectedBehavior) {
          case('toxicity'): {
            highest = await redditModel.find({})
              .sort({"analytics.perspective.toxicity": -1})
              .select(['identifier', 'analytics', 'metrics', 'createdAt', 'updatedAt'])
              .limit(100);
            break;
          } case('severeToxicity'): {
            highest = await redditModel.find({})
              .sort({"analytics.perspective.severeToxicity": -1})
              .select(['identifier', 'analytics', 'metrics', 'createdAt', 'updatedAt'])
              .limit(100);
            break;
          } case('insult'): {
            highest = await redditModel.find({})
              .sort({"analytics.perspective.insult": -1})
              .select(['identifier', 'analytics', 'metrics', 'createdAt', 'updatedAt'])
              .limit(100);
            break;
          } case('threat'): {
            highest = await redditModel.find({})
              .sort({"analytics.perspective.threat": -1})
              .select(['identifier', 'analytics', 'metrics', 'createdAt', 'updatedAt'])
              .limit(100);
            break;
          } case('profanity'): {
            highest = await redditModel.find({})
              .sort({"analytics.perspective.profanity": -1})
              .select(['identifier', 'analytics', 'metrics', 'createdAt', 'updatedAt'])
              .limit(100);
            break;
          } case('identityAttack'): {
            highest = await redditModel.find({})
              .sort({"analytics.perspective.identityAttack": -1})
              .select(['identifier', 'analytics', 'metrics', 'createdAt', 'updatedAt'])
              .limit(100);
            break;
          }
        }
        respondWithSuccessAndData(
          res, 
          highest, 
          `Reddit data sorted by highest ${req.query.behavior}`
          )
      } catch(error) {
        console.log(error)
        respondWithError(res);
      }
    }
  ]

  static average = [
    query('behavior')
      .exists().withMessage('Value is required')
      .isString().withMessage('Value needs to be string'),
    validate,
    async(req: Request, res: Response) => {
      try {
        const selectedBehavior = `$analytics.perspective.${req.query.behavior}`
        const label = req.query.behavior
        const average = await redditModel.aggregate([
          { $group : { _id : null, label : { $avg : selectedBehavior } } }
        ]);
        respondWithSuccessAndData(
          res,
          average,
          `Reddit average of ${req.query.behavior}`
        )
      } catch (error) {
        console.log(error)
        respondWithError(res);
      }
    }
  ]

  static all = [
    async(req: Request, res: Response) => {
      try {
        const all = await redditModel.find({});
        respondWithSuccessAndData(
          res, 
          all, 
          `Reddit all data`
        );
      } catch(error) {
        console.log(error)
        respondWithError(res);
      }
    }
  ]
}

async function analyze(identifier: string) {
  type redditModelInterface = {
    identifier: string,
    metrics: {
      totalSubmissions?: number
      totalComments?: number,
      medianScoreComments?: number,
      medianScoreSubmissions?: number,
      averageScoreComments?: number,
      averageScoreSubmissions?: number,
    },
    context: {
      subredditsForComments?: {subreddit: string; count: number}[],
      subredditsForSubmissions?: {subreddit: string; count: number}[],
      subreddits?: {subreddit: string; count: number}[],
    },
    analytics: {
      perspective: {
        toxicity?: number,
        severeToxicity?: number,
        threat?: number,
        identityAttack?: number,
        profanity?: number,
        insult?: number,
      },
    },
  };

  const redditModel: redditModelInterface = {
    identifier,
    metrics: {},
    context: {},
    analytics: {
      perspective: {}
    },
  }

  log.info(`ANALYSIS`, `Analyzing information (${identifier})`);

  const submissionsResponse = await getSubmissionsFromRedditUserOnPushshift(
      identifier,
  );
  const submissions = submissionsResponse.data;

  const commentsResponse = await getCommentsFromRedditUserOnPushshift(
      identifier,
  );
  const comments = commentsResponse.data;

  const textSnippets = getTextSnippetsOfRedditPosts(submissions.data, comments.data)
      .slice(0, 30).join('; ');

  if (textSnippets !== '') {
    const perspective = await ToxicityContext.analyze(textSnippets);
    log.info(`ANALYSIS`, `Toxicity (${identifier})`)
    console.log(perspective);
    redditModel.analytics.perspective.toxicity = perspective.toxicity;
    redditModel.analytics.perspective.severeToxicity = perspective.severeToxicity;
    redditModel.analytics.perspective.threat = perspective.threat;
    redditModel.analytics.perspective.identityAttack = perspective.identityAttack;
    redditModel.analytics.perspective.insult = perspective.insult;
    redditModel.analytics.perspective.profanity = perspective.profanity;
  }

  redditModel.metrics.totalSubmissions = submissions.data.length;
  redditModel.metrics.totalComments = comments.data.length;

  const commentScores: number[] = [];
  const commentSubreddits: string[] = [];

  const submissionScores: number[] = [];
  const submissionSubreddits: string[] = [];

  for (const comment of comments.data) {
    commentScores.push(comment.score);
    commentSubreddits.push(comment.subreddit);
  }

  for (const submission of submissions.data) {
    submissionScores.push(submission.score);
    submissionSubreddits.push(submission.subreddit);
  }

  redditModel.metrics.medianScoreComments = getMedianOfNumberArray(
      commentScores,
  );
  redditModel.metrics.medianScoreSubmissions = getMedianOfNumberArray(
      submissionScores,
  );

  redditModel.metrics.averageScoreComments = getAverageOfNumberArray(
      commentScores,
  );
  redditModel.metrics.averageScoreSubmissions = getAverageOfNumberArray(
      submissionScores,
  );
  redditModel.metrics.totalComments = commentSubreddits.length;
  redditModel.metrics.totalSubmissions = submissionSubreddits.length;

  redditModel.context.subredditsForComments = getCountOfSubreddits(
      commentSubreddits
  );
  redditModel.context.subredditsForSubmissions = getCountOfSubreddits(
      submissionSubreddits
  );

  let mergedSubreddits: string[] = [];
  mergedSubreddits = mergedSubreddits.concat(submissionSubreddits, commentSubreddits)
  redditModel.context.subreddits = getCountOfSubreddits(
      mergedSubreddits
  )

  return redditModel;
}

async function analyzeWithExamples(identifier: string) {
  const detailedAnalysis = await getDetailedAnalysis(identifier);
  console.log(detailedAnalysis);
  const attributes = ['toxicity', 'severeToxicity', 'insult', 'identityAttack', 'threat', 'profanity'];
  
  const maxToxicity = detailedAnalysis.reduce((max, current) => max.behavior.toxicity > current.behavior.toxicity ? max : current);
  const maxSevereToxicity = detailedAnalysis.reduce((max, current) => max.behavior.severeToxicity > current.behavior.severeToxicity ? max : current);
  const maxInsult = detailedAnalysis.reduce((max, current) => max.behavior.insult > current.behavior.insult ? max : current);
  const maxIdentityAttack = detailedAnalysis.reduce((max, current) => max.behavior.identityAttack > current.behavior.identityAttack ? max : current);
  const maxThreat = detailedAnalysis.reduce((max, current) => max.behavior.threat > current.behavior.threat ? max : current);
  const maxProfanity = detailedAnalysis.reduce((max, current) => max.behavior.profanity > current.behavior.profanity ? max : current);
  
  const date = new Date();
  let exemplaryComments = {};
  exemplaryComments = {
    toxicity: {
      text: maxToxicity.text,
      value: maxToxicity.behavior.toxicity,
      updatedAt: date.toISOString(),
    },
    severeToxicity: {
      text: maxSevereToxicity.text,
      value: maxSevereToxicity.behavior.severeToxicity,
      updatedAt: date.toISOString(),
    },
    insult: {
      text: maxInsult.text,
      value: maxInsult.behavior.insult,
      updatedAt: date.toISOString(),
    },
    identityAttack: {
      text: maxIdentityAttack.text,
      value: maxIdentityAttack.behavior.identityAttack,
      updatedAt: date.toISOString(),
    },
    threat: {
      text: maxThreat.text,
      value: maxThreat.behavior.threat,
      updatedAt: date.toISOString(),
    },
    profanity: {
      text: maxProfanity.text,
      value: maxProfanity.behavior.profanity,
      updatedAt: date.toISOString(),
    },
  }
  console.log(exemplaryComments);
  return exemplaryComments;
}

async function getDetailedAnalysis(identifier: string): Promise<{
      text: string,
      behavior: {
        toxicity: number,
        severeToxicity: number,
        insult: number,
        identityAttack: number,
        threat: number,
        profanity: number,
      }
    }[]> {
  return new Promise(async (resolve, reject) => {
    const NUMBER_OF_POSTS_TO_CONSIDER = 30;

    log.info(`ANALYSIS WITH EXAMPLES`, `Analyzing information (${identifier})`);

    const submissionsResponse = await getSubmissionsFromRedditUserOnPushshift(
        identifier,
    );
    const submissions: PushshiftRedditPost[] = submissionsResponse.data.data;

    const commentsResponse = await getCommentsFromRedditUserOnPushshift(
        identifier,
    );
    const comments: PushshiftRedditPost[] = commentsResponse.data.data;

    let posts: PushshiftRedditPost[] = [];
    posts = posts.concat(submissions, comments);

    posts = sortRedditPostsByCreatedUTC(posts);

    posts = posts.slice(0, NUMBER_OF_POSTS_TO_CONSIDER);

    const detailedAnalysis: {
      text: string,
      behavior: {
        toxicity: number,
        severeToxicity: number,
        insult: number,
        identityAttack: number,
        threat: number,
        profanity: number,
      }
    }[] = [];
    for (const post of posts) {
      let postText: string = '';
      if (post.selftext !== undefined && post.selftext !== '' && post.selftext !== '[removed]') {
        const text = beautifyRedditText(post.selftext);
        if (text !== '') {
          postText = text;
        }
      } else if (post.body !== undefined && post.body !== '' && post.body !== '[removed]') {
        const text = beautifyRedditText(post.body)
        if (text !== '') {
          postText = text;
        }
      }
      if (postText !== '') {
        try {
          const behaviorResult = await ToxicityContext.analyze(postText);
          let postAnalysis = {
            text: postText,
            behavior: {
              toxicity: behaviorResult.toxicity ? behaviorResult.toxicity : 0,
              severeToxicity: behaviorResult.severeToxicity ? behaviorResult.severeToxicity : 0,
              insult: behaviorResult.insult ? behaviorResult.insult : 0,
              identityAttack: behaviorResult.identityAttack ? behaviorResult.identityAttack : 0,
              threat: behaviorResult.threat ? behaviorResult.threat : 0,
              profanity: behaviorResult.profanity ? behaviorResult.profanity : 0,
            }
          }
          detailedAnalysis.push(postAnalysis);
        } catch(error) {
          console.log(error);
        }
      }
    }
    resolve(detailedAnalysis);
  })
  

  
}

function getAverageOfNumberArray(numberArray: number[]): number {
  if (numberArray.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const element of numberArray) {
    sum += element;
  }
  return sum / numberArray.length;
}

function getMedianOfNumberArray(numberArray: number[]) {
  numberArray = numberArray.sort();
  let result: number;
  const mid = Math.floor(numberArray.length / 2);
  result = numberArray[mid];
  if (numberArray.length % 2 === 0) {
    result = (numberArray[mid - 1] + numberArray[mid]) / 2;
  }
  if (isNaN(result)) {
    return 0;
  }
  return result;
}

/**
 * Returns an array of strings originating of the sorted submission and comments
 * @param submissions pushshift submission object
 * @param comments pushshift comment object
 * @returns each string is one text snippet
 */
function getTextSnippetsOfRedditPosts(submissions: PushshiftRedditPost[], comments: PushshiftRedditPost[]) {
  let posts: PushshiftRedditPost[] = [];
  posts = posts.concat(submissions, comments);
  posts = sortRedditPostsByCreatedUTC(posts);
  const textSnippets: string[] = [];
  for (const post of posts) {
    if (post.selftext !== undefined && post.selftext !== '' && post.selftext !== '[removed]') {
      const text = beautifyRedditText(post.selftext);
      if (text !== '') {
        textSnippets.push(text);
      }
    } else if (post.body !== undefined && post.body !== '' && post.body !== '[removed]') {
      const text = beautifyRedditText(post.body)
      if (text !== '') {
        textSnippets.push(text);
      }
    }
  }
  return textSnippets;
}

function sortRedditPostsByCreatedUTC(arrayOfRedditPosts: PushshiftRedditPost[]) {
  return arrayOfRedditPosts.sort((a: PushshiftRedditPost, b: PushshiftRedditPost) => b.created_utc - a.created_utc);
}

/**
 * Cleans up reddit text from text that would be difficult to interprete by an analytics tool
 * @param text 
 * @returns
 */
function beautifyRedditText(text: string) {
 return text
    // Remove quotes (indicated through '> Lorem ipsum')
    .replace(/^(>.+)$/g, '')
    // Remove links (indicated through '[text](url)')
    .replace(/(\[.+\]\(.+\))/g, '')
    .replace(/(\(http\S+\))/g, '')
    .replace(/(\(www\S+\))/g, '')
    // Remove line breaks, tabs and similar
    .replace(/[\n\r\t\s]+/g, ' ');
}
