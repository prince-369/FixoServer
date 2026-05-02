import Counter from '../models/Counter';

const getDateCode = (date: Date): string => {
  const yy = date.getFullYear().toString().slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

export const generateTicketNumber = async (): Promise<string> => {
  const now = new Date();
  const dateCode = getDateCode(now);
  const counterKey = `help-ticket:${dateCode}`;

  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const sequence = String(counter.seq).padStart(5, '0');
  return `SUP-${dateCode}-${sequence}`;
};
