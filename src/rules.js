// Heuristic rules linking classic command themes to OOP classes.

/** theme -> classes that commonly replace commands of that theme */
export const THEME_RULES = {
  'System Documents': ['File', 'Folder', 'FileHandle', 'ZipArchive'],
  'File and Folder': ['File', 'Folder', 'FileHandle', 'ZipArchive', 'ZipFile', 'ZipFolder'],
  Collections: ['Collection'],
  Arrays: ['Collection'],
  'Objects (Language)': ['Collection'],
  JSON: ['Collection'],
  Mail: ['SMTPTransporter', 'POP3Transporter', 'IMAPTransporter', 'Email', 'MailAttachment'],
  HTTP: ['HTTPRequest', 'HTTPAgent', 'IncomingMessage', 'OutgoingMessage'],
  'Web Services (Client)': ['HTTPRequest'],
  Processes: ['Signal', 'SystemWorker', 'Session'],
  'Process (Communications)': ['Signal'],
  Communications: ['TCPConnection', 'TCPListener', 'UDPSocket'],
  'Web Server': ['WebServer', 'Session', 'IncomingMessage', 'OutgoingMessage', 'WebSocketServer'],
  BLOB: ['Blob'],
  Formulas: ['Formula', 'Function'],
  'Secured Protocol': ['CryptoKey'],
  '4D Environment': ['DataStore', 'Session'],
  'Users and Groups': ['Session'],
  // ORDA
  Records: ['DataClass', 'Entity', 'EntitySelection', 'DataStore'],
  Queries: ['DataClass', 'EntitySelection'],
  Selection: ['EntitySelection', 'DataClass', 'Entity'],
  Sets: ['EntitySelection'],
  'Named Selections': ['EntitySelection'],
  Relations: ['Entity', 'EntitySelection'],
  'Record Locking': ['Entity', 'DataStore'],
  Transactions: ['DataStore'],
  'On a Series': ['EntitySelection'],
  'Structure Access': ['DataStore', 'DataClass'],
  Table: ['DataClass', 'DataStore'],
};

/** Themes whose mappings belong to the ORDA section by default. */
export const ORDA_THEMES = new Set([
  'Records',
  'Queries',
  'Selection',
  'Sets',
  'Named Selections',
  'Relations',
  'Record Locking',
  'Transactions',
  'On a Series',
  'Structure Access',
  'Table',
  'Triggers',
]);

/** Classes considered ORDA. */
export const ORDA_CLASSES = new Set(['DataStore', 'DataClass', 'Entity', 'EntitySelection', 'QuotaManager']);

/** Token synonyms used by name similarity (classic word -> OOP words). */
export const SYNONYMS = {
  document: ['file', 'text', 'content'],
  documents: ['file', 'files'],
  folder: ['folder', 'folders'],
  array: ['collection'],
  element: ['item', 'insert', 'remove'],
  append: ['push', 'append'],
  insert: ['insert'],
  delete: ['delete', 'remove', 'drop'],
  sort: ['sort', 'orderby'],
  find: ['find', 'indexof', 'query'],
  records: ['entity', 'entities', 'all'],
  record: ['entity'],
  selection: ['entityselection', 'selection'],
  size: ['length', 'size', 'count'],
  copy: ['copy', 'copyto'],
  move: ['moveto'],
  rename: ['rename'],
  create: ['create', 'new'],
  send: ['send', 'write'],
  receive: ['read', 'receive', 'response'],
  packet: ['text', 'line', 'blob'],
  query: ['query'],
  order: ['orderby'],
  distinct: ['distinct'],
  sum: ['sum'],
  average: ['average'],
  max: ['max'],
  min: ['min'],
  blob: ['blob', 'slice'],
  lock: ['lock'],
  unlock: ['unlock'],
};

export const STOP_WORDS = new Set(['to', 'from', 'of', 'a', 'the', 'in', 'on', 'by', 'with', 'is', 'and', 'or', 'for', 'at']);
