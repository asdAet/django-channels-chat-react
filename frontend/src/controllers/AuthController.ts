import { apiService } from '../adapters/ApiService'
import type { LoginDto, RegisterDto, UpdateProfileDto } from '../dto/auth'
import type { SessionDto, UserProfileDto } from '../dto/auth'

class AuthController {
  public async ensureCsrf(): Promise<{ csrfToken: string }> {
    return await apiService.ensureCsrf()
  }

  public async getSession(): Promise<SessionDto> {
    return await apiService.getSession()
  }

  public async login(dto: LoginDto): Promise<SessionDto> {
    return await apiService.login(dto.username, dto.password)
  }

  public async register(dto: RegisterDto): Promise<SessionDto> {
    return await apiService.register(dto.username, dto.password1, dto.password2)
  }

  public async logout(): Promise<{ ok: boolean }> {
    return await apiService.logout()
  }

  public async updateProfile(dto: UpdateProfileDto): Promise<{ user: UserProfileDto }> {
    return await apiService.updateProfile(dto)
  }
}

export const authController = new AuthController()

