const {
  validatePlayerId,
  validateLeagueId, 
  validateUserId,
  validateSeason,
  validateWeek,
  validatePosition,
  validateTeam,
  sanitizeSearchTerm
} = require('../../src/utils/validation')

describe('Validation Utils Comprehensive Coverage', () => {
  describe('validatePlayerId', () => {
    test('should validate numeric player IDs', () => {
      expect(validatePlayerId('123')).toBe(true)
      expect(validatePlayerId('0')).toBe(true)
      expect(validatePlayerId('999999')).toBe(true)
    })

    test('should reject invalid player IDs', () => {
      expect(validatePlayerId('')).toBe(false)
      expect(validatePlayerId('abc')).toBe(false)
      expect(validatePlayerId('-1')).toBe(false)
      expect(validatePlayerId('1.5')).toBe(false)
      expect(validatePlayerId(null)).toBe(false)
      expect(validatePlayerId(undefined)).toBe(false)
      expect(validatePlayerId('1e10')).toBe(false)
    })
  })

  describe('validateLeagueId', () => {
    test('should validate numeric league IDs', () => {
      expect(validateLeagueId('123456789012345678')).toBe(true)
      expect(validateLeagueId('1')).toBe(true)
      expect(validateLeagueId('999999999999999999')).toBe(true)
    })

    test('should reject invalid league IDs', () => {
      expect(validateLeagueId('')).toBe(false)
      expect(validateLeagueId('abc')).toBe(false)
      expect(validateLeagueId('123abc')).toBe(false)
      expect(validateLeagueId(null)).toBe(false)
      expect(validateLeagueId(undefined)).toBe(false)
      expect(validateLeagueId('1.0')).toBe(false)
    })
  })

  describe('validateUserId', () => {
    test('should validate alphanumeric user IDs', () => {
      expect(validateUserId('user123')).toBe(true)
      expect(validateUserId('123')).toBe(true)
      expect(validateUserId('abc')).toBe(true)
      expect(validateUserId('user_123')).toBe(true)
      expect(validateUserId('user-123')).toBe(true)
    })

    test('should reject invalid user IDs', () => {
      expect(validateUserId('')).toBe(false)
      expect(validateUserId('user@email.com')).toBe(false)
      expect(validateUserId('user space')).toBe(false)
      expect(validateUserId('user!@#')).toBe(false)
      expect(validateUserId(null)).toBe(false)
      expect(validateUserId(undefined)).toBe(false)
    })
  })

  describe('validateSeason', () => {
    test('should validate valid seasons', () => {
      expect(validateSeason('2024')).toBe(true)
      expect(validateSeason('2023')).toBe(true)
      expect(validateSeason('2020')).toBe(true)
      expect(validateSeason('2011')).toBe(true) // First valid season
    })

    test('should reject invalid seasons', () => {
      expect(validateSeason('2010')).toBe(false) // Too early
      expect(validateSeason('2030')).toBe(false) // Too far in future
      expect(validateSeason('abc')).toBe(false)
      expect(validateSeason('')).toBe(false)
      expect(validateSeason('24')).toBe(false)
      expect(validateSeason('20240')).toBe(false)
      expect(validateSeason(null)).toBe(false)
      expect(validateSeason(undefined)).toBe(false)
    })
  })

  describe('validateWeek', () => {
    test('should validate valid weeks', () => {
      expect(validateWeek('1')).toBe(true)
      expect(validateWeek('18')).toBe(true)
      expect(validateWeek('22')).toBe(true) // Playoffs
      expect(validateWeek(1)).toBe(true) // Number input
      expect(validateWeek(18)).toBe(true)
    })

    test('should reject invalid weeks', () => {
      expect(validateWeek('0')).toBe(false)
      expect(validateWeek('23')).toBe(false) // Too high
      expect(validateWeek('-1')).toBe(false)
      expect(validateWeek('abc')).toBe(false)
      expect(validateWeek('')).toBe(false)
      expect(validateWeek('1.5')).toBe(false)
      expect(validateWeek(null)).toBe(false)
      expect(validateWeek(undefined)).toBe(false)
      expect(validateWeek(0)).toBe(false)
      expect(validateWeek(23)).toBe(false)
    })
  })

  describe('validatePosition', () => {
    test('should validate valid positions', () => {
      expect(validatePosition('QB')).toBe(true)
      expect(validatePosition('RB')).toBe(true)
      expect(validatePosition('WR')).toBe(true)
      expect(validatePosition('TE')).toBe(true)
      expect(validatePosition('K')).toBe(true)
      expect(validatePosition('DEF')).toBe(true)
      expect(validatePosition('qb')).toBe(true) // Case insensitive
      expect(validatePosition('def')).toBe(true)
    })

    test('should reject invalid positions', () => {
      expect(validatePosition('INVALID')).toBe(false)
      expect(validatePosition('')).toBe(false)
      expect(validatePosition('QB1')).toBe(false)
      expect(validatePosition('LB')).toBe(false) // Not fantasy position
      expect(validatePosition('DB')).toBe(false)
      expect(validatePosition(null)).toBe(false)
      expect(validatePosition(undefined)).toBe(false)
      expect(validatePosition('QUARTERBACK')).toBe(false)
    })
  })

  describe('validateTeam', () => {
    test('should validate valid team codes', () => {
      expect(validateTeam('KC')).toBe(true)
      expect(validateTeam('BUF')).toBe(true)
      expect(validateTeam('NE')).toBe(true)
      expect(validateTeam('MIA')).toBe(true)
      expect(validateTeam('kc')).toBe(true) // Case insensitive
      expect(validateTeam('buf')).toBe(true)
    })

    test('should reject invalid team codes', () => {
      expect(validateTeam('')).toBe(false)
      expect(validateTeam('INVALID')).toBe(false)
      expect(validateTeam('XX')).toBe(false)
      expect(validateTeam('K')).toBe(false) // Too short
      expect(validateTeam('KCCC')).toBe(false) // Too long
      expect(validateTeam(null)).toBe(false)
      expect(validateTeam(undefined)).toBe(false)
      expect(validateTeam('123')).toBe(false)
    })
  })

  describe('sanitizeSearchTerm', () => {
    test('should sanitize basic search terms', () => {
      expect(sanitizeSearchTerm('  mahomes  ')).toBe('mahomes')
      expect(sanitizeSearchTerm('MAHOMES')).toBe('mahomes')
      expect(sanitizeSearchTerm('Patrick Mahomes')).toBe('patrick mahomes')
    })

    test('should remove HTML tags and dangerous content', () => {
      expect(sanitizeSearchTerm('player<script>alert("xss")</script>')).toBe('playeralert("xss")')
      expect(sanitizeSearchTerm('test>alert')).toBe('testalert')
      expect(sanitizeSearchTerm('<div>player</div>')).toBe('player')
      expect(sanitizeSearchTerm('player<img src="x">')).toBe('player')
    })

    test('should limit length', () => {
      const longTerm = 'a'.repeat(60)
      expect(sanitizeSearchTerm(longTerm)).toBe('a'.repeat(50))
      expect(sanitizeSearchTerm('a'.repeat(30))).toBe('a'.repeat(30))
    })

    test('should handle special characters appropriately', () => {
      expect(sanitizeSearchTerm("player's name")).toBe("player's name")
      expect(sanitizeSearchTerm('player-name')).toBe('player-name')
      expect(sanitizeSearchTerm('player.name')).toBe('player.name')
      expect(sanitizeSearchTerm('player_name')).toBe('player_name')
    })

    test('should handle non-string inputs', () => {
      expect(sanitizeSearchTerm(null)).toBe('')
      expect(sanitizeSearchTerm(undefined)).toBe('')
      expect(sanitizeSearchTerm(123)).toBe('123')
      expect(sanitizeSearchTerm({})).toBe('[object object]')
      expect(sanitizeSearchTerm([])).toBe('')
    })

    test('should handle empty and whitespace inputs', () => {
      expect(sanitizeSearchTerm('')).toBe('')
      expect(sanitizeSearchTerm('   ')).toBe('')
      expect(sanitizeSearchTerm('\t\n  ')).toBe('')
    })

    test('should preserve valid punctuation', () => {
      expect(sanitizeSearchTerm("O'Dell Beckham Jr.")).toBe("o'dell beckham jr.")
      expect(sanitizeSearchTerm('D.K. Metcalf')).toBe('d.k. metcalf')
      expect(sanitizeSearchTerm('Chris Jones-Smith')).toBe('chris jones-smith')
    })

    test('should handle unicode characters', () => {
      expect(sanitizeSearchTerm('José García')).toBe('josé garcía')
      expect(sanitizeSearchTerm('François Müller')).toBe('françois müller')
    })
  })

  describe('Edge Cases and Integration', () => {
    test('should handle boundary values correctly', () => {
      // Season boundaries
      expect(validateSeason('2011')).toBe(true)
      expect(validateSeason('2010')).toBe(false)
      
      // Week boundaries  
      expect(validateWeek('1')).toBe(true)
      expect(validateWeek('22')).toBe(true)
      expect(validateWeek('23')).toBe(false)
    })

    test('should handle type coercion consistently', () => {
      // Numbers as strings
      expect(validateWeek(1)).toBe(true)
      expect(validateWeek('1')).toBe(true)
      
      // Invalid type coercions
      expect(validateUserId(123)).toBe(false)
      expect(validatePosition(123)).toBe(false)
    })

    test('should handle all NFL team codes', () => {
      const nflTeams = [
        'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
        'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
        'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
        'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
      ]
      
      nflTeams.forEach(team => {
        expect(validateTeam(team)).toBe(true)
        expect(validateTeam(team.toLowerCase())).toBe(true)
      })
    })

    test('should handle all fantasy positions', () => {
      const fantasyPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
      
      fantasyPositions.forEach(position => {
        expect(validatePosition(position)).toBe(true)
        expect(validatePosition(position.toLowerCase())).toBe(true)
      })
    })
  })
})
