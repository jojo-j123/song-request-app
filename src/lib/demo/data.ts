// Song metadata only (title/artist) — used to simulate realistic request traffic.
export const DEMO_SONGS: Array<[string, string]> = [
  ['Blinding Lights', 'The Weeknd'], ['Levitating', 'Dua Lipa'], ['One More Time', 'Daft Punk'],
  ['Titanium', 'David Guetta'], ['Wake Me Up', 'Avicii'], ['Don\'t Start Now', 'Dua Lipa'],
  ['Mr. Brightside', 'The Killers'], ['Uptown Funk', 'Mark Ronson'], ['Get Lucky', 'Daft Punk'],
  ['Shut Up and Dance', 'Walk the Moon'], ['Dancing Queen', 'ABBA'], ['September', 'Earth, Wind & Fire'],
  ['Crazy in Love', 'Beyoncé'], ['Yeah!', 'Usher'], ['Hey Ya!', 'OutKast'], ['Seven Nation Army', 'The White Stripes'],
  ['Levels', 'Avicii'], ['Animals', 'Martin Garrix'], ['Clarity', 'Zedd'], ['Lean On', 'Major Lazer'],
  ['Summer', 'Calvin Harris'], ['One Kiss', 'Calvin Harris'], ['Don\'t You Worry Child', 'Swedish House Mafia'],
  ['Greyhound', 'Swedish House Mafia'], ['Strobe', 'deadmau5'], ['Opus', 'Eric Prydz'], ['Losing It', 'FISHER'],
  ['Cola', 'CamelPhat'], ['Innerbloom', 'RÜFÜS DU SOL'], ['Turn Down for What', 'DJ Snake'],
  ['Bad Guy', 'Billie Eilish'], ['As It Was', 'Harry Styles'], ['Flowers', 'Miley Cyrus'],
  ['Anti-Hero', 'Taylor Swift'], ['Shake It Off', 'Taylor Swift'], ['Cruel Summer', 'Taylor Swift'],
  ['Espresso', 'Sabrina Carpenter'], ['Padam Padam', 'Kylie Minogue'], ['Houdini', 'Dua Lipa'],
  ['Calm Down', 'Rema'], ['Tití Me Preguntó', 'Bad Bunny'], ['Despacito', 'Luis Fonsi'],
  ['Pepas', 'Farruko'], ['Gasolina', 'Daddy Yankee'], ['Mi Gente', 'J Balvin'], ['Unholy', 'Sam Smith'],
  ['Stay', 'The Kid LAROI'], ['Industry Baby', 'Lil Nas X'], ['HUMBLE.', 'Kendrick Lamar'],
  ['SICKO MODE', 'Travis Scott'], ['God\'s Plan', 'Drake'], ['In Da Club', '50 Cent'],
  ['Lose Yourself', 'Eminem'], ['Empire State of Mind', 'JAY-Z'], ['Old Town Road', 'Lil Nas X'],
  ['Mo Bamba', 'Sheck Wes'], ['Rolling in the Deep', 'Adele'], ['Halo', 'Beyoncé'],
  ['Single Ladies', 'Beyoncé'], ['Toxic', 'Britney Spears'], ['...Baby One More Time', 'Britney Spears'],
  ['Wannabe', 'Spice Girls'], ['I Wanna Dance with Somebody', 'Whitney Houston'], ['Billie Jean', 'Michael Jackson'],
  ['Thriller', 'Michael Jackson'], ['Don\'t Stop Me Now', 'Queen'], ['Bohemian Rhapsody', 'Queen'],
  ['Sweet Child O\' Mine', 'Guns N\' Roses'], ['Livin\' on a Prayer', 'Bon Jovi'], ['Africa', 'Toto'],
  ['Take On Me', 'a-ha'], ['Girls Just Want to Have Fun', 'Cyndi Lauper'], ['Like a Prayer', 'Madonna'],
  ['Smells Like Teen Spirit', 'Nirvana'], ['Wonderwall', 'Oasis'], ['Song 2', 'Blur'],
  ['Feel Good Inc.', 'Gorillaz'], ['Do I Wanna Know?', 'Arctic Monkeys'], ['Midnight City', 'M83'],
  ['Pumped Up Kicks', 'Foster the People'], ['Electric Feel', 'MGMT'], ['Sweet Disposition', 'The Temper Trap'],
  ['Shape of You', 'Ed Sheeran'], ['Perfect', 'Ed Sheeran'], ['Someone Like You', 'Adele'],
  ['Watermelon Sugar', 'Harry Styles'], ['Physical', 'Dua Lipa'], ['Save Your Tears', 'The Weeknd'],
  ['Starboy', 'The Weeknd'], ['Can\'t Feel My Face', 'The Weeknd'], ['Sunflower', 'Post Malone'],
  ['Circles', 'Post Malone'], ['Happier', 'Marshmello'], ['Closer', 'The Chainsmokers'],
  ['Something Just Like This', 'The Chainsmokers'], ['Faded', 'Alan Walker'], ['Lush Life', 'Zara Larsson'],
  ['Cheap Thrills', 'Sia'], ['Chandelier', 'Sia'], ['Firework', 'Katy Perry'], ['Teenage Dream', 'Katy Perry'],
  ['Party Rock Anthem', 'LMFAO'], ['I Gotta Feeling', 'Black Eyed Peas'], ['Tik Tok', 'Kesha'],
  ['Poker Face', 'Lady Gaga'], ['Bad Romance', 'Lady Gaga'], ['Rain On Me', 'Lady Gaga'],
  ['Murder on the Dancefloor', 'Sophie Ellis-Bextor'], ['Sandstorm', 'Darude'], ['Freed from Desire', 'Gala'],
  ['Rhythm Is a Dancer', 'SNAP!'], ['What Is Love', 'Haddaway'], ['Blue (Da Ba Dee)', 'Eiffel 65'],
  ['Mr. Saxobeat', 'Alexandra Stan'], ['Mockingbird', 'Eminem'], ['Peaches', 'Justin Bieber'],
  ['Sorry', 'Justin Bieber'], ['Shivers', 'Ed Sheeran'], ['Kill Bill', 'SZA'], ['Snooze', 'SZA'],
  ['Water', 'Tyla'], ['Rush', 'Ayra Starr'], ['Essence', 'Wizkid'], ['Last Last', 'Burna Boy'],
  ['Habibi', 'Ricky Rich'], ['Tamally Maak', 'Amr Diab'], ['Nour El Ein', 'Amr Diab'], ['3 Daqat', 'Abu'],
];

const FIRST = [
  'Mia', 'Omar', 'Lena', 'Noah', 'Sofia', 'Karim', 'Ava', 'Lucas', 'Yara', 'Ethan', 'Nadia', 'Leo', 'Zara', 'Adam',
  'Chloe', 'Malik', 'Isla', 'Hassan', 'Emma', 'Diego', 'Layla', 'Jonas', 'Maya', 'Rami', 'Nora', 'Theo', 'Salma',
  'Felix', 'Amira', 'Kai', 'Lily', 'Youssef', 'Hana', 'Max', 'Ines', 'Sami', 'Grace', 'Ali', 'Ruby', 'Jad', 'Elena',
  'Marco', 'Dina', 'Oscar', 'Farah', 'Liam', 'Rana', 'Nico', 'Jana', 'Tariq',
];
const LAST = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.', 'G.', 'H.', 'K.', 'L.', 'M.', 'N.', 'R.', 'S.', 'T.', 'Z.'];

export function demoGuests(n = 100) {
  const out: Array<{ id: string; name: string }> = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: `demo-guest-${i}`, name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}` });
  }
  return out;
}

export const DEMO_DEDICATIONS = ['the bride & groom', 'my best friend', 'Mom', 'the birthday girl', 'everyone here'];
