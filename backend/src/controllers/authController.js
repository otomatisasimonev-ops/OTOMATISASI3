import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

//Nambah fungsi buat login handler
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({
      where: {
        username: username,
      },
    });

    if (user) {
      //Data User itu nanti bakalan dipake buat ngesign token kan
      // data user dari sequelize itu harus diubah dulu ke bentuk object
      //Safeuserdata dipake biar lebih dinamis, jadi dia masukin semua data user kecuali data-data sensitifnya  karena bisa didecode kayak password caranya gini :
      const userPlain = user.toJSON(); // Konversi ke object
      const { password: _, refresh_token: __, ...safeUserData } = userPlain;

      const decryptPassword = await bcrypt.compare(password, user.password);
      if (decryptPassword) {
        const accessToken = jwt.sign(
          safeUserData,
          process.env.ACCESS_TOKEN_SECRET,
          {
            //expiresIn: "30s",
            expiresIn: "60m", //for testing purpose
          }
        );
        const refreshToken = jwt.sign(
          safeUserData,
          process.env.REFRESH_TOKEN_SECRET,
          {
            expiresIn: "1d",
          }
        );
        await User.update({ refresh_token: null }, { where: { id: user.id } });
        await User.update(
          { refresh_token: refreshToken },
          {
            where: {
              id: user.id,
            },
          }
        );
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true, //ngatur cross-site scripting, untuk penggunaan asli aktifkan karena bisa nyegah serangan fetch data dari website "document.cookies"
          sameSite: "lax", //ini ngatur domain yg request misal kalo strict cuman bisa akseske link dari dan menuju domain yg sama, lax itu bisa dari domain lain tapi cuman bisa get
          maxAge: 24 * 60 * 60 * 1000,
          secure: false, //ini ngirim cookies cuman bisa dari https, kenapa? nyegah skema MITM di jaringan publik, tapi pas development di false in aja
        });
        res.status(200).json({
          status: "Succes",
          message: "Login Berhasil",
          safeUserData,
          accessToken,
        });
      } else {
        res.status(400).json({
          status: "Failed",
          message: "Paassword atau email salah",
        });
      }
    } else {
      res.status(400).json({
        status: "Failed",
        message: "Paassword atau email salah",
      });
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({
      status: "error",
      message: error.message,
    });
  }
}

//nambah logout
const logout = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  //console.log({ refreshToken });

  // Tidak ada refresh token? Langsung hapus cookie, tidak perlu sentuh DB
  if (!refreshToken) {
    res.clearCookie("refreshToken");
    return res.sendStatus(204); // No Content
  }

  const user = await User.findOne({
    where: {
      refresh_token: refreshToken,
    },
  });

  // Token tidak cocok dengan database
  if (!user) {
    res.clearCookie("refreshToken"); // tetap hapus cookie
    return res.sendStatus(204);
  }

  // Token cocok → hanya hapus dari DB untuk device ini
  await User.update(
    { refresh_token: null },
    {
      where: {
        id: user.id,
      },
    }
  );

  res.clearCookie("refreshToken"); // hapus cookie dari browser
  return res.sendStatus(200);
}

export {
  login,
  logout
};
