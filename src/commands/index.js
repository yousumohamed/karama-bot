import help from './help.js';
import welcome from './welcome.js';

// Add new commands here.
export const commands = new Map([help, welcome].map((command) => [command.name, command]));
