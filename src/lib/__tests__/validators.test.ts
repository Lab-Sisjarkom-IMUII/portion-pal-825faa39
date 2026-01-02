import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  goalFormSchema,
} from '../validators';

describe('loginSchema', () => {
  it('should validate correct login data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
    };
    
    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('email');
    }
  });

  it('should reject short password', () => {
    const invalidData = {
      email: 'test@example.com',
      password: '12345', // Less than 6 characters
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Password');
    }
  });

  it('should reject empty email', () => {
    const invalidData = {
      email: '',
      password: 'password123',
    };
    
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('should validate correct register data', () => {
    const validData = {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    };
    
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject mismatched passwords', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'Different123',
    };
    
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Password tidak sama');
    }
  });

  it('should reject password without uppercase', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    };
    
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('huruf besar');
    }
  });

  it('should reject password without lowercase', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'PASSWORD123',
      confirmPassword: 'PASSWORD123',
    };
    
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject password without number', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'test@example.com',
      password: 'Password',
      confirmPassword: 'Password',
    };
    
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject short name', () => {
    const invalidData = {
      name: 'J',
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    };
    
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject name with numbers', () => {
    const invalidData = {
      name: 'John123',
      email: 'test@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    };
    
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('goalFormSchema', () => {
  it('should validate correct goal data for lose_weight', () => {
    const validData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
      target_weight: 70,
    };
    
    const result = goalFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate correct goal data for reduce_calories', () => {
    const validData = {
      goal_type: 'reduce_calories',
      age: 30,
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
    };
    
    const result = goalFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid age', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 5, // Too young
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
      target_weight: 70,
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid height', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'male',
      height: 50, // Too short
      weight: 80,
      activity: 'moderate',
      target_time: '12',
      target_weight: 70,
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid weight', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'male',
      height: 175,
      weight: 10, // Too light
      activity: 'moderate',
      target_time: '12',
      target_weight: 70,
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should require target_weight for lose_weight', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
      // target_weight missing
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('target berat badan');
    }
  });

  it('should reject target_weight greater than current weight for lose_weight', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
      target_weight: 90, // Greater than current weight
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('lebih kecil');
    }
  });

  it('should reject invalid goal_type', () => {
    const invalidData = {
      goal_type: 'invalid' as any,
      age: 30,
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid gender', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'invalid' as any,
      height: 175,
      weight: 80,
      activity: 'moderate',
      target_time: '12',
      target_weight: 70,
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject invalid activity', () => {
    const invalidData = {
      goal_type: 'lose_weight',
      age: 30,
      gender: 'male',
      height: 175,
      weight: 80,
      activity: 'invalid' as any,
      target_time: '12',
      target_weight: 70,
    };
    
    const result = goalFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

