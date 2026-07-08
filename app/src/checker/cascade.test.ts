import { describe, expect, it } from 'vitest';
import { checkAnswer } from './cascade';
import { normalize } from './normalize';

const RU_STIMULUS = 'Ты часто забываешь имена?';

function correct(userInput: string, enMain: string, enAccepted: string[] = []) {
  return checkAnswer({ userInput, ruStimulus: RU_STIMULUS, enMain, enAccepted });
}

describe('tier 0: pre-check', () => {
  it.each([
    ['', 'I am a student.'],
    ['   ', 'I am a student.'],
    ['Я студент', 'I am a student.'],
    ['я не знаю', 'I am a student.'],
    ['Ты часто забываешь имена?', 'Do you often forget names?'],
  ])('rejects %j without spending a cascade tier', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.tier).toBe(0);
    expect(result.verdict).toBe('wrong');
  });
});

describe('tier 1: exact match (with normalization)', () => {
  it.each([
    ['I am a student.', 'I am a student.'],
    ['i am a student', 'I am a student.'],
    ['I AM A STUDENT', 'I am a student.'],
    ['I am a student', 'I am a student.'],
  ])('%j matches %j verbatim', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });

  it('matches against en_accepted alternates', () => {
    const result = correct('Do you forget names often?', 'Do you often forget names?', [
      'Do you forget names often?',
    ]);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });

  it('matches a previously accepted-cache entry', () => {
    const result = checkAnswer({
      userInput: 'You often forget names, right?',
      ruStimulus: RU_STIMULUS,
      enMain: 'Do you often forget names?',
      acceptedCache: ['You often forget names, right?'],
    });
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 1: contractions, incl. ambiguous \'s / \'d branching', () => {
  it.each([
    ["I don't eat meat.", 'I do not eat meat.'],
    ['I do not eat meat.', "I don't eat meat."],
    ["She doesn't like coffee.", 'She does not like coffee.'],
    ["He isn't here.", 'He is not here.'],
    ["They aren't ready.", 'They are not ready.'],
    ["I can't swim.", 'I cannot swim.'],
    ["I won't go.", 'I will not go.'],
    ["Let's go.", 'Let us go.'],
    ["I'm a student.", 'I am a student.'],
    ["You're right.", 'You are right.'],
    ["We're happy.", 'We are happy.'],
    ["They're late.", 'They are late.'],
    ["I'll call you.", 'I will call you.'],
    ["I've seen it.", 'I have seen it.'],
    // Ambiguous 's: both branches must be accepted.
    ["He's happy.", 'He is happy.'],
    ["He's finished.", 'He has finished.'],
    ["It's raining.", 'It is raining.'],
    ["It's stopped raining.", 'It has stopped raining.'],
    ["That's true.", 'That is true.'],
    ["There's a book.", 'There is a book.'],
    // Ambiguous 'd: both branches must be accepted.
    ["I'd like a coffee.", 'I would like a coffee.'],
    ["I'd already left.", 'I had already left.'],
    ["She'd help you.", 'She would help you.'],
    ["She'd never seen it.", 'She had never seen it.'],
    // Multi-apostrophe sentence (both contractions expanded together).
    ["I'm sure she's right.", 'I am sure she is right.'],
    ["I'd say they're wrong.", 'I would say they are wrong.'],
  ])('%j <-> %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 1: BrE/AmE spelling, incl. learnt/learned', () => {
  it.each([
    ['My favourite colour is grey.', 'My favorite color is gray.'],
    ['My favorite color is gray.', 'My favourite colour is grey.'],
    ['I learnt English.', 'I learned English.'],
    ['I learned English.', 'I learnt English.'],
    ['She organised the centre.', 'She organized the center.'],
    ['We travelled a lot.', 'We traveled a lot.'],
    ['He apologised.', 'He apologized.'],
    ['I burnt the toast.', 'I burned the toast.'],
    ['They cancelled the programme.', 'They canceled the program.'],
  ])('%j <-> %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 1: number words <-> digits (both directions consistent)', () => {
  it.each([
    ['I have two brothers.', 'I have 2 brothers.'],
    ['I have 2 brothers.', 'I have two brothers.'],
    ['She is twenty two.', 'She is 22.'],
    ['I have twenty nine dollars.', 'I have 29 dollars.'],
    ['He is ninety.', 'He is 90.'],
    ['I want the red one.', 'I want the red one.'],
  ])('%j <-> %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 2: typo tolerance (single word, edit distance 1)', () => {
  it.each([
    ['Do you oftne read?', 'Do you often read?'],
    ['She lkes coffee.', 'She likes coffee.'],
    ['I havv a car.', 'I have a car.'],
    ['Teh book is here.', 'The book is here.'],
  ])('%j is a tier-2 typo-corrected match for %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(2);
    expect(result.tag).toBe('spelling');
  });
});

describe('tier 2 guard: morphology is not a typo (work/works)', () => {
  it.each([
    ['He work in an office.', 'He works in an office.'],
    ['He works in an office.', 'He work in an office.'],
    ['I watch movie.', 'I watch movies.'],
    ['She study hard.', 'She studies hard.'],
  ])('%j vs %j is rejected, not tier-2-corrected', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('wrong');
  });
});

describe('tier 2 guard: real other words are not typos', () => {
  it.each([
    ['I want a car.', 'I went a car.'],
    ['I went home.', 'I want home.'],
    ['It is than good.', 'It is then good.'],
    ['It is then good.', 'It is than good.'],
    ['The floor is lose.', 'The floor is loose.'],
    ['The floor is loose.', 'The floor is lose.'],
  ])('%j vs %j: both are real words, not typo-corrected', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('wrong');
  });
});

describe('tier 2 guard: articles/prepositions are grammar errors, not typos', () => {
  it.each([
    ['I have car.', 'I have a car.'],
    ['The book is table.', 'The book is on the table.'],
    ['I live at this city.', 'I live in this city.'],
    ['She is good at cooking.', 'She is good in cooking.'],
  ])('%j vs %j is a grammar miss, not a typo', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('wrong');
  });
});

describe('wrong answers (no partial credit without a judge)', () => {
  it.each([
    ['I am happy.', 'I am sad.'],
    ['He likes tea.', 'She likes tea.'],
    ['Do you like it?', 'Does he like it?'],
    ['random gibberish words here', 'I am a student.'],
  ])('%j is simply wrong against %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('wrong');
  });
});

describe('tier 1: additional contraction forms not covered above', () => {
  it.each([
    ["She wasn't ready.", 'She was not ready.'],
    ["They weren't home.", 'They were not home.'],
    ["We haven't finished.", 'We have not finished.'],
    ["He hasn't called.", 'He has not called.'],
    ["I hadn't noticed.", 'I had not noticed.'],
    ["You wouldn't like it.", 'You would not like it.'],
    ["She shouldn't worry.", 'She should not worry.'],
    ["I couldn't hear you.", 'I could not hear you.'],
    ["He mustn't forget.", 'He must not forget.'],
    ["You'll see.", 'You will see.'],
    ["He'll come.", 'He will come.'],
    ["She'll help.", 'She will help.'],
    ["We'll wait.", 'We will wait.'],
    ["They'll agree.", 'They will agree.'],
    ["It'll work.", 'It will work.'],
    ["You've got it.", 'You have got it.'],
    ["We've tried.", 'We have tried.'],
    ["They've left.", 'They have left.'],
    ["What's wrong?", 'What is wrong?'],
    ["What's happened?", 'What has happened?'],
    ["Here's your coffee.", 'Here is your coffee.'],
    ["Who's calling?", 'Who is calling?'],
    ["Who's arrived?", 'Who has arrived?'],
    ["You'd better go.", 'You would better go.'],
    ["You'd already gone.", 'You had already gone.'],
    ["We'd love that.", 'We would love that.'],
    ["We'd forgotten.", 'We had forgotten.'],
    ["They'd agree.", 'They would agree.'],
    ["They'd arrived.", 'They had arrived.'],
  ])('%j <-> %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 1: additional BrE/AmE pairs not covered above', () => {
  it.each([
    ['He realised his mistake.', 'He realized his mistake.'],
    ['She recognised the song.', 'She recognized the song.'],
    ['I analysed the data.', 'I analyzed the data.'],
    ['They criticised the plan.', 'They criticized the plan.'],
    ['She is a good traveller.', 'She is a good traveler.'],
    ['The event was cancelled.', 'The event was canceled.'],
    ['We are modelling the risk.', 'We are modeling the risk.'],
    ['Check the jewellery box.', 'Check the jewelry box.'],
    ['My mum is here.', 'My mom is here.'],
    ['There is mould on it.', 'There is mold on it.'],
    ['He ploughs the field.', 'He plows the field.'],
    ['I felt a draught.', 'I felt a draft.'],
    ['Write me a cheque.', 'Write me a check.'],
    ['I am sceptical.', "I'm sceptical."],
    ['It is made of aluminium.', 'It is made of aluminum.'],
    ['New tyres cost a lot.', 'New tires cost a lot.'],
    ['Mind the kerb.', 'Mind the curb.'],
    ['She flew the aeroplane.', 'She flew the airplane.'],
    ['That is a good catalogue.', 'That is a good catalog.'],
    ['Read the dialogue.', 'Read the dialog.'],
    ['He needs a licence.', 'He needs a license.'],
    ['Practise every day.', 'Practice every day.'],
  ])('%j <-> %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 1: additional number words <-> digits', () => {
  it.each([
    ['I have three apples.', 'I have 3 apples.'],
    ['I have 3 apples.', 'I have three apples.'],
    ['She has four cats.', 'She has 4 cats.'],
    ['We waited five minutes.', 'We waited 5 minutes.'],
    ['He has six brothers.', 'He has 6 brothers.'],
    ['I need seven days.', 'I need 7 days.'],
    ['There are eight of us.', 'There are 8 of us.'],
    ['She is eleven.', 'She is 11.'],
    ['He is twelve.', 'He is 12.'],
    ['I have thirteen books.', 'I have 13 books.'],
    ['We need thirty minutes.', 'We need 30 minutes.'],
    ['He is forty.', 'He is 40.'],
    ['She has fifty dollars.', 'She has 50 dollars.'],
    ['It costs sixty dollars.', 'It costs 60 dollars.'],
    ['I have seventy pages.', 'I have 70 pages.'],
    ['She is eighty.', 'She is 80.'],
    ['I have one hundred books.', 'I have 100 books.'],
  ])('%j <-> %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('tier 2: additional typo-tolerance cases', () => {
  it.each([
    ['I lvoe you.', 'I love you.'],
    ['She is verry tired.', 'She is very tired.'],
    ['We need som help.', 'We need some help.'],
    ['He is a docter.', 'He is a doctor.'],
    ['I recieved the letter.', 'I received the letter.'],
  ])('%j is a tier-2 typo-corrected match for %j', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(2);
    expect(result.tag).toBe('spelling');
  });
});

describe('tier 2 guard: additional real-word confusions are not typos', () => {
  it.each([
    ['I saw a snake.', 'I saw a stake.'],
    ['The dog is here.', 'The dog is hare.'],
    ['I need a break.', 'I need a bread.'],
    ['She has a plan.', 'She has a plane.'],
  ])('%j vs %j: both are real words, not typo-corrected', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.verdict).toBe('wrong');
  });
});

describe('tier 0: additional pre-check cases', () => {
  it.each([
    ['ничего не понимаю', 'I am a student.'],
    ['Привет, как дела?', 'Hello, how are you?'],
    ['\n\t  \n', 'I am a student.'],
  ])('rejects %j without spending a cascade tier', (input, enMain) => {
    const result = correct(input, enMain);
    expect(result.tier).toBe(0);
    expect(result.verdict).toBe('wrong');
  });
});

describe('tier 1: cache-hit variants', () => {
  it.each([
    ['You forget names a lot, right?', 'Do you often forget names?', ['You forget names a lot, right?']],
    ['You seem to forget names.', 'Do you often forget names?', ['You seem to forget names.']],
  ])('%j matches an accepted-cache entry for %j', (input, enMain, cache) => {
    const result = checkAnswer({
      userInput: input,
      ruStimulus: RU_STIMULUS,
      enMain,
      acceptedCache: cache,
    });
    expect(result.verdict).toBe('correct');
    expect(result.tier).toBe(1);
  });
});

describe('normalize(): set semantics', () => {
  it('returns both branches for an ambiguous contraction', () => {
    const result = normalize("he's tired");
    expect(result.has('he is tired')).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    const a = normalize('  I   AM   a Student.  ');
    const b = normalize('i am a student');
    expect([...a]).toEqual([...b]);
  });

  it('folds BrE and AmE to the same canonical form', () => {
    const a = normalize('grey colour');
    const b = normalize('gray color');
    expect([...a]).toEqual([...b]);
  });

  it.each([
    ['zero', '0'],
    ['one', '1'],
    ['nine', '9'],
    ['ten', '10'],
    ['nineteen', '19'],
    ['twenty', '20'],
    ['twenty one', '21'],
    ['ninety nine', '99'],
  ])('folds number word %j to digit %j', (word, digit) => {
    expect([...normalize(word)]).toEqual([...normalize(digit)]);
  });
});
