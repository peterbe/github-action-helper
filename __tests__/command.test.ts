/* eslint-disable no-magic-numbers */
import { EOL } from 'os';
import global from './global';
import { Logger, Command } from '../src';
import { testLogger } from './util';

describe('Command', () => {
	testLogger();
	afterEach(() => {
		global.mockChildProcess.stdout = 'stdout';
		global.mockChildProcess.stderr = '';
		global.mockChildProcess.error = null;
	});

	const command = new Command(new Logger());

	it('should run command', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		expect(await command.execAsync({command: 'test'})).toBe('stdout');

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(mockStdout).toBeCalledTimes(2);
		expect(mockStdout.mock.calls[0][0]).toBe('[command]test' + EOL);
		expect(mockStdout.mock.calls[1][0]).toBe('  >> stdout' + EOL);
	});

	it('should run command with cwd, altCommand', async() => {
		global.mockChildProcess.stderr = 'stderr';
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		expect(await command.execAsync({command: 'test', cwd: 'dir', altCommand: 'alt'})).toBe('stdout');

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(execMock.mock.calls[0][1]).toEqual({'cwd': 'dir'});
		expect(mockStdout).toBeCalledTimes(3);
		expect(mockStdout.mock.calls[0][0]).toBe('[command]alt' + EOL);
		expect(mockStdout.mock.calls[1][0]).toBe('  >> stdout' + EOL);
		expect(mockStdout.mock.calls[2][0]).toBe('##[warning]  >> stderr' + EOL);
	});

	it('should catch error 1', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
		})).rejects.toBe('command [test] exited with code 123. message: test message');
	});

	it('should catch error 2', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
			altCommand: 'alt',
		})).rejects.toBe('command [alt] exited with code 123. message: test message');
	});

	it('should catch error 3', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
			altCommand: 'alt',
			quiet: true,
		})).rejects.toBe('command [alt] exited with code 123.');
	});

	it('should catch error 4', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
			quiet: true,
		})).rejects.toBe('command exited with code 123.');
	});

	it('should suppress stdout', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		await command.execAsync({
			command: 'test',
			suppressOutput: true,
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(mockStdout).toBeCalledTimes(1);
		expect(mockStdout.mock.calls[0][0]).toBe('[command]test' + EOL);
	});

	it('should not output stdout', async() => {
		global.mockChildProcess.stdout = '';
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		await command.execAsync({
			command: 'test',
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(mockStdout).toBeCalledTimes(1);
		expect(mockStdout.mock.calls[0][0]).toBe('[command]test' + EOL);
	});

	it('should run suppress error command', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		await command.execAsync({
			command: 'test',
			suppressError: true,
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test || :');
		expect(mockStdout).toBeCalledTimes(2);
		expect(mockStdout.mock.calls[0][0]).toBe('[command]test' + EOL);
		expect(mockStdout.mock.calls[1][0]).toBe('  >> stdout' + EOL);
	});
});
