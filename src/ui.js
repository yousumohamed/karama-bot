import { ActionRowBuilder, LabelBuilder, MessageFlags, TextInputBuilder, TextInputStyle } from 'discord.js';

// Small helpers shared by every feature's panels, menus and modals.

export const row = (...components) => new ActionRowBuilder().addComponents(components);

export const ephemeral = (payload) => ({
  ...(typeof payload === 'string' ? { content: payload } : payload),
  flags: MessageFlags.Ephemeral,
});

export function textField(customId, label, { style = TextInputStyle.Short, value, placeholder, required = false, max, description } = {}) {
  const input = new TextInputBuilder().setCustomId(customId).setStyle(style).setRequired(required);
  if (value) input.setValue(value);
  if (placeholder) input.setPlaceholder(placeholder);
  if (max) input.setMaxLength(max);
  const field = new LabelBuilder().setLabel(label).setTextInputComponent(input);
  if (description) field.setDescription(description);
  return field;
}
