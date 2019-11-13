/* eslint-disable no-magic-numbers */
import nock from 'nock';
import path from 'path';
import { GitHub } from '@actions/github' ;
import { GitCreateTreeResponse, GitCreateCommitResponse } from '@octokit/rest';
import {
	disableNetConnect,
	testEnv,
	getContext,
	getApiFixture,
	createResponse,
	spyOnStdout,
	stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { ApiHelper, Logger } from '../src';

const rootDir = path.resolve(__dirname, 'fixtures');
const context = getContext({
	ref: 'refs/heads/test',
	repo: {
		owner: 'hello',
		repo: 'world',
	},
	sha: '7638417db6d59f3c431d3e1f261cc637155684cd',
	payload: {
		sender: {
			type: 'User',
			login: 'octocat',
		},
		number: 123,
	},
});
const octokit = new GitHub('');

const createCommitResponse = createResponse<GitCreateCommitResponse>({
	author: {
		date: '',
		email: '',
		name: '',
	},
	committer: {
		date: '',
		email: '',
		name: '',
	},
	message: '',
	'node_id': '',
	parents: [],
	sha: '',
	tree: {
		sha: '',
		url: '',
	},
	url: '',
	verification: {
		payload: null,
		reason: '',
		signature: null,
		verified: true,
	},
});

describe('ApiHelper', () => {
	disableNetConnect(nock);
	testEnv();
	beforeEach(() => {
		Logger.resetForTesting();
	});

	const helper = new ApiHelper(new Logger());

	describe('filesToBlobs', () => {
		it('should return empty', async() => {
			expect(await helper.filesToBlobs(rootDir, [], new GitHub(''), context)).toHaveLength(0);
		});

		it('should return blobs', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.post('/repos/hello/world/git/blobs', body => {
					fn1();
					expect(body).toHaveProperty('content');
					expect(body).toHaveProperty('encoding');
					return body;
				})
				.reply(201, () => {
					fn2();
					return getApiFixture(rootDir, 'repos.git.blobs');
				});

			const blobs = await helper.filesToBlobs(rootDir, ['build1.json', 'build2.json'], octokit, context);
			expect(blobs).toHaveLength(2);
			expect(fn1).toBeCalledTimes(2);
			expect(fn2).toBeCalledTimes(2);
		});
	});

	describe('createTree', () => {
		it('should create tree', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			const fn3 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => {
					fn1();
					return getApiFixture(rootDir, 'repos.git.commits.get');
				})
				.post('/repos/hello/world/git/trees', body => {
					fn2();
					expect(body).toHaveProperty('base_tree');
					expect(body).toHaveProperty('tree');
					return body;
				})
				.reply(201, () => {
					fn3();
					return getApiFixture(rootDir, 'repos.git.trees');
				});

			const tree = await helper.createTree([
				{
					path: 'test-path1',
					sha: 'test-sha1',
				},
				{
					path: 'test-path2',
					sha: 'test-sha2',
				},
			], octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
			expect(fn3).toBeCalledTimes(1);
			expect(tree).toHaveProperty('status');
			expect(tree).toHaveProperty('url');
			expect(tree).toHaveProperty('headers');
			expect(tree).toHaveProperty('data');
			expect(tree.status).toBe(201);
		});
	});

	describe('createCommit', () => {
		it('should create commit', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.post('/repos/hello/world/git/commits', body => {
					fn1();
					expect(body).toHaveProperty('tree');
					expect(body).toHaveProperty('parents');
					expect(body.parents).toEqual(['7638417db6d59f3c431d3e1f261cc637155684cd']);
					return body;
				})
				.reply(201, () => {
					fn2();
					return getApiFixture(rootDir, 'repos.git.commits');
				});

			const commit = await helper.createCommit('test commit message', createResponse<GitCreateTreeResponse>({
				sha: 'tree-sha',
				tree: [],
				url: '',
			}), octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
			expect(commit).toHaveProperty('status');
			expect(commit).toHaveProperty('url');
			expect(commit).toHaveProperty('headers');
			expect(commit).toHaveProperty('data');
			expect(commit.status).toBe(201);
		});

		it('should create PR commit', async() => {
			const fn = jest.fn();
			nock('https://api.github.com')
				.post('/repos/hello/world/git/commits', body => {
					expect(body.parents).toEqual(['test-head-sha']);
					return body;
				})
				.reply(201, () => {
					fn();
					return getApiFixture(rootDir, 'repos.git.commits');
				});

			const commit = await helper.createCommit('test commit message', createResponse<GitCreateTreeResponse>({
				sha: 'tree-sha',
				tree: [],
				url: '',
			}), octokit, Object.assign({}, context, {
				ref: 'refs/pull/123/merge',
				payload: {
					'pull_request': {
						head: {
							sha: 'test-head-sha',
						},
					},
				},
			}));

			expect(fn).toBeCalledTimes(1);
			expect(commit.status).toBe(201);
		});
	});

	describe('updateRef', () => {
		it('should update ref', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/test'), body => {
					fn1();
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(200, () => {
					fn2();
					return getApiFixture(rootDir, 'repos.git.refs.update');
				});

			await helper.updateRef(createCommitResponse, await helper.getRefForUpdate(true, octokit, context), false, octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
		});

		it('should update PR ref', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			const fn3 = jest.fn();
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/new-topic'), body => {
					fn1();
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(200, () => {
					fn2();
					return getApiFixture(rootDir, 'repos.git.refs.update');
				})
				.get('/repos/hello/world/pulls/123')
				.reply(200, () => {
					fn3();
					return getApiFixture(rootDir, 'pulls.get');
				});

			const _context = Object.assign({}, context, {
				ref: 'refs/pull/123/merge',
			});
			await helper.updateRef(createCommitResponse, await helper.getRefForUpdate(true, octokit, _context), false, octokit, _context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
			expect(fn3).toBeCalledTimes(1);
		});

		it('should cache PR get api', async() => {
			const fn = jest.fn();
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/new-topic'))
				.reply(200, () => {
					return getApiFixture(rootDir, 'repos.git.refs.update');
				})
				.get('/repos/hello/world/pulls/123')
				.reply(200, () => {
					fn();
					return getApiFixture(rootDir, 'pulls.get');
				});

			const _context = Object.assign({}, context, {
				ref: 'refs/pull/123/merge',
			});
			await helper.updateRef(createCommitResponse, await helper.getRefForUpdate(true, octokit, _context), false, octokit, _context);

			expect(fn).toBeCalledTimes(0);
		});

		it('should output warning', async() => {
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/test'), body => {
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(403, {
					'message': 'Required status check "Test" is expected.',
				});

			await expect(helper.updateRef(createCommitResponse, await helper.getRefForUpdate(true, octokit, context), false, octokit, context)).rejects.toThrow('Required status check "Test" is expected.');
		});
	});

	describe('createRef', () => {
		it('should create ref', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.post('/repos/hello/world/git/refs', body => {
					fn1();
					expect(body).toHaveProperty('sha');
					expect(body).toHaveProperty('ref');
					expect(body.ref).toBe('refs/heads/featureA');
					return body;
				})
				.reply(201, () => {
					fn2();
					return getApiFixture(rootDir, 'repos.git.refs.create');
				});

			await helper.createRef(createCommitResponse, 'refs/heads/featureA', octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
		});
	});

	describe('deleteRef', () => {
		it('should create ref', async() => {
			const fn = jest.fn();
			nock('https://api.github.com')
				.delete('/repos/hello/world/git/refs/heads/featureA')
				.reply(204, () => {
					fn();
					return getApiFixture(rootDir, 'repos.git.refs.create');
				});

			await helper.deleteRef('heads/featureA', octokit, context);

			expect(fn).toBeCalledTimes(1);
		});
	});

	describe('findPullRequest', () => {
		it('should return null', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Atest')
				.reply(200, () => []);

			expect(await helper.findPullRequest('test', octokit, context)).toBeNull();
		});

		it('should return PR', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Atest')
				.reply(200, () => getApiFixture(rootDir, 'pulls.list'));

			const pr = await helper.findPullRequest('test', octokit, context);

			expect(pr).toHaveProperty('id');
			expect(pr).toHaveProperty('number');
			expect(pr).toHaveProperty('title');
			expect(pr).toHaveProperty('body');
		});
	});

	describe('pullsList', () => {
		it('should return pulls list generator', async() => {
			const fn = jest.fn();
			nock('https://api.github.com')
				.get('/repos/hello/world/pulls?sort=created&direction=desc&per_page=100&page=1')
				.reply(200, () => {
					fn();
					return getApiFixture(rootDir, 'pulls.list');
				})
				.get('/repos/hello/world/pulls?sort=created&direction=desc&per_page=100&page=2')
				.reply(200, () => {
					fn();
					return getApiFixture(rootDir, 'pulls.list');
				})
				.get('/repos/hello/world/pulls?sort=created&direction=desc&per_page=100&page=3')
				.reply(200, () => {
					fn();
					return [];
				});

			const generator = helper.pullsList({
				sort: 'created',
				direction: 'desc',
			}, octokit, context);

			let count = 0;
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			for await (const item of generator) {
				count++;
			}

			expect(count).toBe(4);
			expect(fn).toBeCalledTimes(3);
		});
	});

	describe('pullsCreate', () => {
		it('should create pull request', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.post('/repos/hello/world/pulls', body => {
					fn1();
					expect(body).toHaveProperty('head');
					expect(body).toHaveProperty('base');
					expect(body).toHaveProperty('title');
					expect(body).toHaveProperty('body');
					expect(body.head).toBe('hello:test/branch');
					expect(body.base).toBe('test');
					expect(body.title).toBe('test title');
					expect(body.body).toBe('body1\nbody2\nbody3');
					return body;
				})
				.reply(201, () => {
					fn2();
					return getApiFixture(rootDir, 'pulls.create');
				});

			await helper.pullsCreate('test/branch', {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
		});
	});

	describe('pullsUpdate', () => {
		it('should update pull request', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.patch('/repos/hello/world/pulls/1347', body => {
					fn1();
					expect(body).toHaveProperty('title');
					expect(body).toHaveProperty('body');
					expect(body).toHaveProperty('state');
					expect(body.title).toBe('test title');
					expect(body.body).toBe('body1\nbody2\nbody3');
					expect(body.state).toBe('open');
					return body;
				})
				.reply(200, () => {
					fn2();
					return getApiFixture(rootDir, 'pulls.update');
				});

			await helper.pullsUpdate(1347, {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
		});

		it('should close pull request', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.patch('/repos/hello/world/pulls/1347', body => {
					fn1();
					expect(body).toHaveProperty('title');
					expect(body).toHaveProperty('body');
					expect(body).toHaveProperty('state');
					expect(body.title).toBe('test title');
					expect(body.body).toBe('body1\nbody2\nbody3');
					expect(body.state).toBe('closed');
					return body;
				})
				.reply(200, () => {
					fn2();
					return getApiFixture(rootDir, 'pulls.update');
				});

			await helper.pullsUpdate(1347, {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
				state: 'closed',
			}, octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
		});
	});

	describe('pullsCreateOrComment', () => {
		it('should create pull request', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Acreate%2Ftest')
				.reply(200, () => [])
				.post('/repos/hello/world/pulls')
				.reply(201, () => getApiFixture(rootDir, 'pulls.create'));

			const info = await helper.pullsCreateOrComment('create/test', {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context);

			expect(info).toHaveProperty('isPrCreated');
			expect(info['isPrCreated']).toBe(true);
		});

		it('should create comment', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Acreate%2Ftest')
				.reply(200, () => getApiFixture(rootDir, 'pulls.list'))
				.post('/repos/hello/world/issues/1347/comments')
				.reply(201);

			const info = await helper.pullsCreateOrComment('create/test', {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context);

			expect(info).toHaveProperty('isPrCreated');
			expect(info['isPrCreated']).toBe(false);
		});
	});

	describe('createCommentToPr', () => {
		it('should create comment to pull request', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Atest')
				.reply(200, () => getApiFixture(rootDir, 'pulls.list'))
				.post('/repos/hello/world/issues/1347/comments')
				.reply(201);

			expect(await helper.createCommentToPr('test', 'test body', octokit, context)).toBe(true);
		});

		it('should not create comment to pull request 1', async() => {
			expect(await helper.createCommentToPr('test', undefined, octokit, context)).toBe(false);
		});

		it('should not create comment to pull request 2', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Atest')
				.reply(200, () => []);

			expect(await helper.createCommentToPr('test', 'test body', octokit, context)).toBe(false);
		});
	});

	describe('commit', () => {
		it('should not commit', async() => {
			const mockStdout = spyOnStdout();

			expect(await helper.commit(path.resolve(__dirname, '..'), 'test commit message', [], octokit, context)).toBe(false);

			stdoutCalledWith(mockStdout, [
				'> There is no diff.',
			]);
		});

		it('should commit', async() => {
			const mockStdout       = spyOnStdout();
			process.env.GITHUB_SHA = 'sha';
			nock('https://api.github.com')
				.persist()
				.post('/repos/hello/world/git/blobs')
				.reply(201, () => {
					return getApiFixture(rootDir, 'repos.git.blobs');
				})
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.commits.get'))
				.post('/repos/hello/world/git/trees')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.trees'))
				.post('/repos/hello/world/git/commits')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.commits'))
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/test'))
				.reply(200, () => getApiFixture(rootDir, 'repos.git.refs.update'));

			expect(await helper.commit(rootDir, 'test commit message', ['build1.json', 'build2.json'], octokit, context)).toBe(true);
			stdoutCalledWith(mockStdout, [
				'::group::Creating blobs...',
				'::endgroup::',
				'::group::Creating tree...',
				'::endgroup::',
				'::group::Creating commit... [cd8274d15fa3ae2ab983129fb037999f264ba9a7]',
				'::endgroup::',
				'::group::Updating ref... [heads%2Ftest] [7638417db6d59f3c431d3e1f261cc637155684cd]',
				'::set-env name=GITHUB_SHA,::7638417db6d59f3c431d3e1f261cc637155684cd',
				'::endgroup::',
			]);
			expect(process.env.GITHUB_SHA).toBe('7638417db6d59f3c431d3e1f261cc637155684cd');
		});
	});

	describe('createPR', () => {
		it('should do nothing', async() => {
			expect(await helper.createPR(rootDir, 'test commit message', [], 'create/test', {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context)).toBe(false);
		});

		it('should update pull request', async() => {
			const mockStdout       = spyOnStdout();
			process.env.GITHUB_SHA = 'sha';
			nock('https://api.github.com')
				.persist()
				.post('/repos/hello/world/git/blobs')
				.reply(201, () => {
					return getApiFixture(rootDir, 'repos.git.blobs');
				})
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.commits.get'))
				.post('/repos/hello/world/git/trees')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.trees'))
				.post('/repos/hello/world/git/commits')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.commits'))
				.get('/repos/hello/world/git/ref/heads/create/test')
				.reply(404)
				.post('/repos/hello/world/git/refs')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.refs.create'))
				.get('/repos/hello/world/pulls?head=hello%3Acreate%2Ftest')
				.reply(200, () => getApiFixture(rootDir, 'pulls.list'))
				.patch('/repos/hello/world/pulls/1347')
				.reply(200, () => getApiFixture(rootDir, 'pulls.update'));

			const info = await helper.createPR(rootDir, 'test commit message', ['build1.json', 'build2.json'], 'create/test', {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context);
			expect(info).toHaveProperty('html_url');
			expect(info).toHaveProperty('commits_url');
			expect(info).toHaveProperty('comments_url');
			expect(info).toHaveProperty('number');
			expect(info).toHaveProperty('isPrCreated');
			expect(info['html_url']).toBe('https://github.com/hello/world/pull/1347');
			expect(info['number']).toBe(1347);
			expect(info['isPrCreated']).toBe(false);
			stdoutCalledWith(mockStdout, [
				'::group::Creating blobs...',
				'::endgroup::',
				'::group::Creating tree...',
				'::endgroup::',
				'::group::Creating commit... [cd8274d15fa3ae2ab983129fb037999f264ba9a7]',
				'::endgroup::',
				'::group::Creating reference... [refs/heads/create/test] [7638417db6d59f3c431d3e1f261cc637155684cd]',
				'::endgroup::',
				'::group::Updating PullRequest... [create/test] -> [heads/test]',
				'::endgroup::',
			]);
		});

		it('should create pull request', async() => {
			const mockStdout       = spyOnStdout();
			process.env.GITHUB_SHA = 'sha';
			nock('https://api.github.com')
				.persist()
				.post('/repos/hello/world/git/blobs')
				.reply(201, () => {
					return getApiFixture(rootDir, 'repos.git.blobs');
				})
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.commits.get'))
				.post('/repos/hello/world/git/trees')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.trees'))
				.post('/repos/hello/world/git/commits')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.commits'))
				.get('/repos/hello/world/git/ref/heads/create/test')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.ref'))
				.patch('/repos/hello/world/git/refs/heads/create/test')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.refs.update'))
				.post('/repos/hello/world/git/refs')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.refs.create'))
				.get('/repos/hello/world/pulls?head=hello%3Acreate%2Ftest')
				.reply(200, () => [])
				.post('/repos/hello/world/pulls')
				.reply(201, () => getApiFixture(rootDir, 'pulls.create'));

			const info = await helper.createPR(rootDir, 'test commit message', ['build1.json', 'build2.json'], 'create/test', {
				body: [
					'body1',
					'body2',
					'body3',
				].join('\n'),
				title: 'test title',
			}, octokit, context);
			expect(info).toHaveProperty('html_url');
			expect(info).toHaveProperty('commits_url');
			expect(info).toHaveProperty('comments_url');
			expect(info).toHaveProperty('number');
			expect(info).toHaveProperty('isPrCreated');
			expect(info['html_url']).toBe('https://github.com/hello/world/pull/1347');
			expect(info['number']).toBe(1347);
			expect(info['isPrCreated']).toBe(true);
			stdoutCalledWith(mockStdout, [
				'::group::Creating blobs...',
				'::endgroup::',
				'::group::Creating tree...',
				'::endgroup::',
				'::group::Creating commit... [cd8274d15fa3ae2ab983129fb037999f264ba9a7]',
				'::endgroup::',
				'::group::Updating reference... [refs/heads/create/test] [7638417db6d59f3c431d3e1f261cc637155684cd]',
				'::endgroup::',
				'::group::Creating PullRequest... [create/test] -> [heads/test]',
				'::endgroup::',
			]);
		});
	});

	describe('closePR', () => {
		it('should close pull request', async() => {
			const mockStdout = spyOnStdout();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Aclose%2Ftest')
				.reply(200, () => getApiFixture(rootDir, 'pulls.list'))
				.patch('/repos/hello/world/pulls/1347')
				.reply(200, () => getApiFixture(rootDir, 'pulls.update'))
				.delete('/repos/hello/world/git/refs/heads/close/test')
				.reply(204);

			await helper.closePR('close/test', octokit, context);

			stdoutCalledWith(mockStdout, [
				'::group::Closing PullRequest... [close/test]',
				'::endgroup::',
				'::group::Deleting reference... [refs/heads/close/test]',
				'::endgroup::',
			]);
		});

		it('should not close pull request, should delete reference', async() => {
			const mockStdout = spyOnStdout();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Aclose%2Ftest')
				.reply(200, () => [])
				.get('/repos/hello/world/git/ref/heads/close/test')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.ref'))
				.delete('/repos/hello/world/git/refs/heads/close/test')
				.reply(204);

			await helper.closePR('close/test', octokit, context);

			stdoutCalledWith(mockStdout, [
				'> There is no PullRequest named [close/test]',
				'::group::Deleting reference... [refs/heads/close/test]',
				'::endgroup::',
			]);
		});

		it('should not close pull request, should not delete reference', async() => {
			const mockStdout = spyOnStdout();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/pulls?head=hello%3Aclose%2Ftest')
				.reply(200, () => [])
				.get('/repos/hello/world/git/ref/heads/close/test')
				.reply(404);

			await helper.closePR('close/test', octokit, context);

			stdoutCalledWith(mockStdout, [
				'> There is no PullRequest named [close/test]',
				'> There is no reference named [refs/heads/close/test]',
			]);
		});
	});

	describe('getUser', () => {
		it('should throw error 1', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(200, () => {
					fn1();
					return getApiFixture(rootDir, 'users.get');
				});

			await expect(helper.getUser(octokit, getContext({}))).rejects.toThrow('Sender is not valid.');
			expect(fn1).not.toBeCalled();
		});

		it('should throw error 2', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(404, () => {
					fn1();
					return JSON.parse('{"message": "Not Found", "documentation_url": "https://developer.github.com/v3/users/#get-a-single-user"}');
				});

			await expect(helper.getUser(octokit, context)).rejects.toThrow('Not Found');
			expect(fn1).toBeCalledTimes(1);
		});

		it('should get user', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(200, () => {
					fn1();
					return getApiFixture(rootDir, 'users.get');
				});

			const user = await helper.getUser(octokit, context);
			expect(fn1).toBeCalledTimes(1);
			expect(user.login).toBe('octocat');
			expect(user.email).toBe('octocat@github.com');
			expect(user.name).toBe('monalisa octocat');
			expect(user.id).toBe(1);
		});
	});
});
