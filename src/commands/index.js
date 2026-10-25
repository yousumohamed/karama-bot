import help from './help.js';
import invite from './invite.js';
import ping from './ping.js';
import ticket from './ticket.js';
import welcome from './welcome.js';

// Add new commands here — this is also the order ?help lists them in.
export const commandList = [welcome, ticket, invite, ping, help];

// Looked up by name and by alias.
export const commands = new Map(
  commandList.flatMap((command) => [command.name, ...(command.aliases ?? [])].map((name) => [name, command])),
);
